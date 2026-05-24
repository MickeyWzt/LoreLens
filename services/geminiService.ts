
import { DecipherResult, AppLanguage, HistoryItem, DailyRecapResult } from "../types";

const LANGUAGE_NAMES: Record<AppLanguage, string> = {
  en: "English",
  zh: "Simplified Chinese",
  ja: "Japanese",
  es: "Spanish",
  fr: "French",
  ru: "Russian",
  ar: "Arabic"
};

const parseDecipherResponse = (response: any): DecipherResult => {
    const text = response.text;
    if (!text) throw new Error("No text response from AI");

    // Extract Google Maps URI if available from grounding metadata
    let mapUri: string | undefined;
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks) {
        // Look for maps URI first, then web URI
        const mapChunk = groundingChunks.find((c: any) => c.maps?.uri);
        if (mapChunk) {
            mapUri = mapChunk.maps.uri;
        } else {
            const webChunk = groundingChunks.find((c: any) => c.web?.uri);
            if (webChunk) mapUri = webChunk.web.uri;
        }
    }

    // Robust JSON extraction
    let jsonString = text.trim();
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = jsonString.substring(firstBrace, lastBrace + 1);
    } else {
        jsonString = jsonString.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '');
    }
    
    const result = JSON.parse(jsonString) as DecipherResult;
    if (mapUri) {
        result.mapUri = mapUri;
    }
    
    return result;
};

export const decipherImage = async (
  base64Image: string, 
  location?: { lat: number; lng: number },
  language: AppLanguage = 'en'
): Promise<DecipherResult> => {
  const targetLanguage = LANGUAGE_NAMES[language];

  try {
      const res = await fetch("/api/gemini/decipher", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Image, location, targetLanguage })
      });
      if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.details || body.error || `Server error (${res.status})`);
      }
      const data = await res.json();
      return parseDecipherResponse(data.response);
  } catch (finalError: any) {
      console.error("Gemini Analysis Failed:", finalError);
      throw new Error(finalError.message || "Could not interpret the image. Please try again.");
  }
};

export const generateSpeech = async (text: string): Promise<string> => {
  try {
    const res = await fetch("/api/gemini/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.details || body.error || `Server error (${res.status})`);
    }
    const data = await res.json();
    const response = data.response;

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data returned");
    }

    return base64Audio;
  } catch (error) {
    console.error("TTS Generation Failed:", error);
    throw error;
  }
};

export const generateDailyRecap = async (items: HistoryItem[], language: AppLanguage): Promise<DailyRecapResult> => {
  if (items.length === 0) throw new Error("No items to recap");
  
  const langName = LANGUAGE_NAMES[language];
  const itemDescriptions = items
    .map((item, index) => `${index + 1}. ${item.title}: ${item.essence}.`)
    .join('\n');

  try {
      const res = await fetch("/api/gemini/recap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemDescriptions, langName })
      });
      if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.details || body.error || `Server error (${res.status})`);
      }

      const data = await res.json();
      const response = data.response;
      
      const text = response.text;
      if (!text) throw new Error("No response from AI");
      
      return JSON.parse(text) as DailyRecapResult;
  } catch (error) {
      console.error("Recap Generation Failed:", error);
      // Fallback
      return {
          journal: "Today was a journey of discovery through the city's veins.",
          score: 88,
          mood: "Serene",
          tags: ["History", "Architecture", "Soul"],
          archetype: "The Silent Wanderer",
          philosophicalTake: "You have a keen eye for the structures that withstand time, preferring the eternal over the ephemeral."
      };
  }
};
