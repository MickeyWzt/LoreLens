import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for base64 images
  app.use(express.json({ limit: '50mb' }));

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";

  const ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const handleGeminiError = (res: any, error: any, defaultMsg: string) => {
    const errText = error?.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
    console.error(`Gemini Error [${defaultMsg}]:`, errText);
    
    if (
      errText.includes("API_KEY_INVALID") || 
      errText.includes("API key not valid") || 
      errText.includes("INVALID_ARGUMENT") ||
      errText.includes("invalid api key") ||
      errText.includes("leaked") ||
      errText.includes("PERMISSION_DENIED")
    ) {
      return res.status(400).json({
        error: "Invalid or Leaked API Key",
        details: "Your current Gemini API Key was either reported as leaked, invalid, or has expired. Please verify and update your API Key under **Settings > Secrets** in AI Studio."
      });
    }

    if (
      errText.includes("RESOURCE_EXHAUSTED") ||
      errText.includes("quota") ||
      errText.includes("Rate limit") ||
      errText.includes("429")
    ) {
      return res.status(429).json({
        error: "Rate Limit Exceeded (429)",
        details: "You have exceeded your Gemini API quota/rate limits. If you are on the free tier, please wait a minute before trying again or request a paid API key via AI Studio settings."
      });
    }
    
    return res.status(500).json({
      error: defaultMsg,
      details: error?.message || String(error)
    });
  };

  const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

  // --- UNSPLASH API ROUTE ---
  app.get("/api/unsplash", async (req, res) => {
    const query = req.query.query as string;
    if (!query) {
       res.status(400).json({ error: "Missing query" });
       return;
    }

    try {
      if (!UNSPLASH_ACCESS_KEY) {
         console.warn("Missing UNSPLASH_ACCESS_KEY");
         res.status(500).json({ error: "Server config error" });
         return;
      }

      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=portrait&per_page=15`,
        { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
      );

      if (!response.ok) {
         res.status(response.status).json({ error: "Unsplash API error" });
         return;
      }

      const data = await response.json();
      res.json(data);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to fetch from Unsplash" });
    }
  });
  
  app.post("/api/unsplash/download", async (req, res) => {
      const urlStr = req.body.url as string;
      if (!urlStr) { res.status(400).json({ error: "Missing url" }); return; }
      if (!UNSPLASH_ACCESS_KEY) { res.status(500).json({ error: "Server config error" }); return; }
      
      try {
          const parsedUrl = new URL(urlStr);
          if (parsedUrl.host !== "api.unsplash.com" || parsedUrl.protocol !== "https:") {
              res.status(400).json({ error: "Unauthorized download endpoint" });
              return;
          }
          await fetch(urlStr, { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } });
          res.json({ success: true });
      } catch (e) {
          console.error(e);
          res.status(500).json({ error: "Download record failed" });
      }
  });

  // --- NOMINATIM GEOLOCATION REVERSE PROXY ---
  const geoCache = new Map<string, any>();

  app.get("/api/nominatim/reverse", async (req, res) => {
    const lat = req.query.lat as string;
    const lon = req.query.lon as string;
    const lang = (req.query.lang as string) || "en";

    if (!lat || !lon) {
       res.status(400).json({ error: "Missing lat or lon parameters" });
       return;
    }

    const roundedLat = parseFloat(lat).toFixed(4);
    const roundedLon = parseFloat(lon).toFixed(4);
    const cacheKey = `${roundedLat},${roundedLon},${lang}`;

    if (geoCache.has(cacheKey)) {
      res.json(geoCache.get(cacheKey));
      return;
    }

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=12&addressdetails=1&accept-language=${lang}`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "LoreLens/1.1.0 (contact: support@lorelens.org; AIStudio-Build-Proxy)",
          "Referer": "https://lorelens.org"
        }
      });

      if (!response.ok) {
         res.status(response.status).json({ error: "Nominatim API error" });
         return;
      }

      const data = await response.json();
      geoCache.set(cacheKey, data);

      if (geoCache.size > 1000) {
        const firstKey = geoCache.keys().next().value;
        if (firstKey) geoCache.delete(firstKey);
      }

      res.json(data);
    } catch (e) {
      console.error("Nominatim geocoding proxy failed:", e);
      res.status(500).json({ error: "Failed to reverse geocode" });
    }
  });

  // --- GEMINI API ROUTE: DECIPHER ---
  app.post("/api/gemini/decipher", async (req, res) => {
    try {
      const { base64Image, location, targetLanguage } = req.body;
      const cleanBase64 = base64Image.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");

      const attemptDecipher = async (useMaps: boolean) => {
        const tools = useMaps ? [{ googleMaps: {} }] : undefined;
        const toolConfig = (useMaps && location) ? {
            retrievalConfig: {
                latLng: {
                    latitude: location.lat,
                    longitude: location.lng
                }
            }
        } : undefined;

        console.log(`Attempting generateContent. useMaps=${useMaps}, model=gemini-3.5-flash`);

        return await ai.models.generateContent({
          model: "gemini-3.5-flash", 
          contents: {
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
              {
                text: `You are 'Context Lens', a cross-cultural interpreter. 
                Identify the object in the image (likely a Chinese cultural artifact, building, or detail).
                
                ${useMaps ? "Use the googleMaps tool to check if this is a known landmark nearby." : ""}
                
                Provide a response in strict JSON format. 
                CRITICAL: The content of the JSON must be written in ${targetLanguage}.
                
                The JSON object must have these keys:
                - title: The name of the object.
                - essence: A single, punchy sentence explaining 'What is this?'.
                - mirrorInsight: A cross-cultural analogy comparing this to a concept familiar to a speaker of ${targetLanguage}.
                - philosophy: The deeper cultural logic or historical function.
                - quickAction: A suggestion for the user (e.g. 'Look for the...').
                
                Do not include any text outside the JSON.`,
              },
            ],
          },
          config: {
            tools: tools as any,
            toolConfig: toolConfig as any,
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            ],
          },
        });
      };

      let aiResponse;
      try {
          if (!location) throw new Error("No location provided");
          aiResponse = await attemptDecipher(true);
      } catch (primaryError: any) {
          const errText = primaryError?.message || (typeof primaryError === 'object' ? JSON.stringify(primaryError) : String(primaryError));
          if (
              errText.includes("RESOURCE_EXHAUSTED") || 
              errText.includes("quota") || 
              errText.includes("API key not valid") || 
              errText.includes("API_KEY_INVALID") ||
              errText.includes("INVALID_ARGUMENT") ||
              errText.includes("429")
          ) {
              throw primaryError; // Rethrow immediately to let handleGeminiError handle it
          }
          console.warn("Maps attempt failed, retrying without maps. Error:", errText.substring(0, 150) + "...");
          aiResponse = await attemptDecipher(false);
      }

      res.json({
        response: {
          text: aiResponse.text,
          candidates: aiResponse.candidates
        }
      });
    } catch (e: any) {
      handleGeminiError(res, e, "Failed to decipher");
    }
  });

  // --- GEMINI API ROUTE: SPEECH ---
  app.post("/api/gemini/speech", async (req, res) => {
    try {
      const { text } = req.body;
      const aiResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO] as any,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });
      res.json({
        response: {
          text: aiResponse.text,
          candidates: aiResponse.candidates
        }
      });
    } catch (e: any) {
      handleGeminiError(res, e, "Failed to generate speech");
    }
  });

  // --- GEMINI API ROUTE: RECAP ---
  app.post("/api/gemini/recap", async (req, res) => {
      try {
          const { itemDescriptions, langName } = req.body;
        const aiResponse = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: {
                parts: [{
                    text: `You are a philosopher and cultural analyst looking at a traveler's discoveries in Beijing.
                    
                    Here are the items they discovered today:
                    ${itemDescriptions}
                    
                    Analyze their "Resonance" with the city. 
                    - If they looked at architecture, maybe they prefer "static history".
                    - If they looked at people/food, maybe they prefer "living culture".
                    - If mixed, maybe they are a "holistic observer".
                    
                    Please create a "Daily Recap" card in valid JSON format.
                    The content must be written in ${langName}.
                    
                    The JSON object must have these keys:
                    - journal: A poetic travel journal entry (under 100 words). First-person.
                    - score: A number (1-100) representing "Cultural Resonance" based on diversity and depth of items.
                    - mood: A single descriptive word for the mood.
                    - tags: An array of 3-5 short hashtags.
                    - archetype: A cool title for the user based on their finds (e.g. "The Socratic Observer", "The Urban Poet", "The Historian").
                    - philosophicalTake: A direct, deep 2-sentence comment to the user about their observation style (e.g., "You tend to find silence in the noise...").
                    `
                }]
            },
            config: {
                responseMimeType: "application/json"
            }
        });
        res.json({
          response: {
            text: aiResponse.text,
            candidates: aiResponse.candidates
          }
        });
      } catch (e: any) {
          handleGeminiError(res, e, "Failed to recap");
      }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    app.use(express.static(path.join(process.cwd(), 'dist')));
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    app.get('*all', (req, res) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
