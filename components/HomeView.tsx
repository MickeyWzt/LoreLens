
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppTheme, AppLanguage } from '../types';
import { IconHistory, IconSettings, IconCamera } from './Icons';
import { useSettingsStore } from '../store/useSettingsStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { getAccentStyles } from '../utils/accent';
import { triggerHaptic } from '../utils';

interface HomeViewProps {
  onScanStart: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
}

const APP_NAME = 'LoreLens';

// Safe Fallback Assets
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=800&q=80"; // Atmospheric cozy street light view
const FALLBACK_CREDIT = { name: "Clem Onojeghuo", link: "https://unsplash.com/@clemono" };

const FALLBACK_CITY_I18N: Record<AppLanguage, string> = {
  en: "Beijing",
  zh: "北京",
  ja: "北京",
  es: "Pekín",
  fr: "Pékin",
  ru: "Пекин",
  ar: "بكين"
};

const LANGUAGE_TO_ENGLISH_CITY: Record<string, string> = {
  // Chinese
  "北京": "Beijing",
  "北京市": "Beijing",
  "上海": "Shanghai",
  "上海市": "Shanghai",
  "西安": "Xi'an",
  "西安市": "Xi'an",
  "深圳": "Shenzhen",
  "深圳市": "Shenzhen",
  "广州": "Guangzhou",
  "广州市": "Guangzhou",
  "杭州": "Hangzhou",
  "杭州市": "Hangzhou",
  "成都": "Chengdu",
  "成都市": "Chengdu",
  "武汉": "Wuhan",
  "武汉市": "Wuhan",
  "重庆": "Chongqing",
  "重庆市": "Chongqing",
  "南京": "Nanjing",
  "南京市": "Nanjing",
  "天津": "Tianjin",
  "天津市": "Tianjin",
  "苏州": "Suzhou",
  "苏州市": "Suzhou",
  "大连": "Dalian",
  "大连市": "Dalian",
  "青岛": "Qingdao",
  "青岛市": "Qingdao",
  "厦门": "Xiamen",
  "厦门市": "Xiamen",
  // Japanese
  "東京": "Tokyo",
  "京都": "Kyoto",
  "大阪": "Osaka",
  // Russian
  "Москва": "Moscow",
  "Санкт-Петербург": "Saint Petersburg",
  // Spanish
  "Pekín": "Beijing",
  "Pékin": "Beijing",
  "Пекин": "Beijing",
  "بكين": "Beijing"
};

const getEnglishCityName = (city: string): string => {
  if (!city) return "";
  const clean = city.replace(/(City|Shi|市)$/i, '').trim();
  return LANGUAGE_TO_ENGLISH_CITY[clean] || LANGUAGE_TO_ENGLISH_CITY[city] || clean;
};

// Dynamic Templates for Unknown Cities
const DYNAMIC_TEMPLATES: Record<AppLanguage, { quote: string; author: string; title: string }[]> = {
  en: [
    { quote: "The pulse of {city} is best heard in the silence between its sounds.", author: "Urban Echoes", title: "Spirit of {city}" },
    { quote: "Every corner in {city} hides a story that history books forgot to mention.", author: "Local Wisdom", title: "Hidden {city}" },
    { quote: "To know {city} is to get lost in its alleys, not its maps.", author: "The Wanderer", title: "{city} Unveiled" }
  ],
  zh: [
    { quote: "{city} 的脉搏，只有在静谧的角落才能听得最真切。", author: "城市回响", title: "{city} 掠影" },
    { quote: "每一座建筑，都是 {city} 写给时间的一封情书。", author: "建筑诗人", title: "{city} 记忆" },
    { quote: "读懂 {city} 的最好方式，是迷失在它的街巷里，而非地图上。", author: "漫游者", title: "寻找 {city}" }
  ],
  ja: [
    { quote: "{city} の鼓動は、静寂な路地裏でこそ最も鮮明に聞こえる。", author: "都市の響き", title: "{city} の心" },
    { quote: "{city} を知るには、地図ではなく、その迷路のような路地に身を委ねることだ。", author: "放浪者", title: "隠された {city}" },
    { quote: "すべての曲がり角に、{city} の語られざる物語が潜んでいる。", author: "路上の賢者", title: "{city} の秘密" }
  ],
  es: [
    { quote: "El alma de {city} se encuentra mejor en el silencio entre sus sonidos.", author: "Ecos Urbanos", title: "Espíritu de {city}" },
    { quote: "Cada rincón de {city} esconde una historia que los libros olvidaron.", author: "Sabiduría Local", title: "{city} Oculta" },
    { quote: "Para conocer {city}, hay que perderse en sus callejones, no en sus mapas.", author: "El Caminante", title: "Descubriendo {city}" }
  ],
  fr: [
    { quote: "L'âme de {city} se trouve mieux dans le silence entre ses bruits.", author: "Échos Urbains", title: "Esprit de {city}" },
    { quote: "Chaque coin de {city} cache une histoire que les livres ont oubliée.", author: "Sagesse Locale", title: "{city} Cachée" },
    { quote: "Pour connaître {city}, il faut se perdre dans ses ruelles, pas sur ses cartes.", author: "Le Promeneur", title: "Découvrir {city}" }
  ],
  ru: [
    { quote: "Пульс города {city} лучше всего слышен в тишине между его звуками.", author: "Городские эхо", title: "Дух города {city}" },
    { quote: "Каждый уголок в {city} скрывает историю, о которой забыли упомянуть учебники.", author: "Местная мудрость", title: "Скрытый {city}" },
    { quote: "Узнать {city} — значит затеряться в его переулках, а не на картах.", author: "Странник", title: "{city} без прикрас" }
  ],
  ar: [
    { quote: "يُسمع نبض {city} بوضوح في الصمت بين أصواتها.", author: "أصداء حضرية", title: "روح {city}" },
    { quote: "تخفي كل زاوية في {city} قصة نسيت كتب التاريخ ذكرها.", author: "حكمة محلية", title: "{city} المخفية" },
    { quote: "لكي تعرف {city} حقًا، عليك أن تتوه في أزقتها لا في خرائطها.", author: "المتجول", title: "اكتشاف {city}" }
  ]
};

const INSIGHTS_DB = [
    {
        city: "Beijing",
        items: [
            {
                quote: "Hidden cafe corners and narrow alleys hold the true, unhurried rhythm of local life.",
                author: "Urban Explorer",
                title: "Corner Vibe",
                keywords: "cozy neighborhood cafe aesthetic exterior"
            },
            {
                quote: "When the golden hour paint strokes the rooftops, the city stops for a moment to breathe.",
                author: "The Wanderer",
                title: "Golden Hour Street",
                keywords: "city rooftops golden hour sunset aesthetic"
            },
            {
                quote: "The texture of weathered bricks and timeless stone reflects the quiet endurance of memory.",
                author: "History Whisperer",
                title: "Timeless Architecture",
                keywords: "city historic building entry facade"
            }
        ]
    },
    {
        city: "Shanghai",
        items: [
             {
                quote: "Where the past meets the future across the river bend.",
                author: "The Bund",
                title: "Lujiazui Skyline",
                keywords: "shanghai tower skyline"
            },
            {
                quote: "Lilong lanes weave stories of a golden era.",
                author: "Old City",
                title: "Xintiandi",
                keywords: "shanghai old street brick"
            }
        ]
    },
    {
        city: "Xi'an",
        items: [
            {
                quote: "Silent soldiers guarding an emperor's eternal dream.",
                author: "Terracotta Warriors",
                title: "Qin Dynasty",
                keywords: "terracotta warriors close up"
            }
        ]
    }
];

// Fallback if no location found at all
const DEFAULT_INSIGHTS = [
    {
        quote: "Tea is drunk to forget the din of the world.",
        author: "T'ien Yi-heng",
        title: "Tea Culture",
        keywords: "chinese tea ceremony pouring"
    }
];

export const HomeView: React.FC<HomeViewProps> = ({ 
  onScanStart, 
  onOpenHistory, 
  onOpenSettings
}) => {
  const { t } = useTranslation();
  const { theme, language, accentColor, reduceMotion } = useSettingsStore();
  const { history } = useHistoryStore();
  const isDark = theme === 'dark';
  
  const accent = getAccentStyles(accentColor, isDark);
  const totalDiscoveries = history.length;
  
  // Calculate today's discoveries under local system calendar date
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayDiscoveries = history.filter(item => item.timestamp >= todayStart.getTime()).length;
  
  const [greeting, setGreeting] = useState('');
  
  // Location State
  const [locationName, setLocationName] = useState('Beijing');
  const [currentCity, setCurrentCity] = useState('Beijing');
  const [currentDistrict, setCurrentDistrict] = useState('');
  
  // Content State
  const [insight, setInsight] = useState(INSIGHTS_DB[0].items[0]);
  const [currentImage, setCurrentImage] = useState<string>("");
  const [photoCredit, setPhotoCredit] = useState<{name: string, link: string} | null>(null);
  const [photoDownloadUrl, setPhotoDownloadUrl] = useState<string | null>(null);
  const [photoDownloadLocation, setPhotoDownloadLocation] = useState<string | null>(null);

  // Helper: Get Time Context
  const getTimeContext = (): { timeQuery: string } => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return { timeQuery: "morning light" };
    if (hour >= 12 && hour < 17) return { timeQuery: "sunny afternoon" };
    if (hour >= 17 && hour < 20) return { timeQuery: "sunset golden hour" };
    return { timeQuery: "night neon street" };
  };

  const fetchUnsplashPhoto = async (query: string): Promise<boolean> => {
      const CACHE_KEY = `lorelens_img_group_${query}`;
      const CACHE_EXPIRY = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

      const applyRandomPhoto = (results: any[]) => {
          if (!results || results.length === 0) return false;
          const photo = results[Math.floor(Math.random() * results.length)];
          if (!photo) return false;

          // 兼容标准 Unsplash API 格式和精简版缓存格式
          const url = photo.urls?.regular || photo.url;
          const downloadUrl = photo.urls?.full || photo.urls?.raw || photo.downloadUrl || url;
          const downloadLocation = photo.links?.download_location || photo.downloadLocation || null;
          
          let credit = null;
          if (photo.user && photo.user.name) {
              credit = {
                  name: photo.user.name,
                  link: photo.user.links?.html || "https://unsplash.com"
              };
          } else if (photo.credit) {
              credit = photo.credit;
          }

          if (!url) return false;

          setCurrentImage(url);
          setPhotoCredit(credit);
          setPhotoDownloadUrl(downloadUrl);
          setPhotoDownloadLocation(downloadLocation);
          return true;
      };

      try {
          const cachedData = localStorage.getItem(CACHE_KEY);
          if (cachedData) {
              try {
                  const parsed = JSON.parse(cachedData);
                  if (
                      Array.isArray(parsed.results) &&
                      Date.now() - parsed.timestamp < CACHE_EXPIRY
                  ) {
                      const applied = applyRandomPhoto(parsed.results);
                      if (applied) return true;
                  }
              } catch (e) {
                  console.warn("Failed to apply cached photo, clearing stale cache:", e);
                  localStorage.removeItem(CACHE_KEY);
              }
          }

          const timeBucket = getTimeContext().timeQuery;
          const response = await fetch(`/api/background?query=${encodeURIComponent(query)}&timeBucket=${encodeURIComponent(timeBucket)}`);
          if (response.status === 204 || response.status === 403 || response.status === 429) return false;
          if (!response.ok) return false;

          const data = await response.json();
          const background = data?.data;
          const results = background?.imageUrl ? [{
              urls: { regular: background.imageUrl, full: background.imageUrl },
              links: { download_location: background.downloadLocation },
              user: {
                  name: background.photographer,
                  links: { html: background.photographerUrl }
              }
          }] : [];
          if (results.length > 0) {
              localStorage.setItem(CACHE_KEY, JSON.stringify({
                  results,
                  timestamp: Date.now()
              }));

              return applyRandomPhoto(results);
          }
      } catch {}

      return false;
  };

  // Explicit user wallpaper save triggering (Unsplash compliant download tracking trigger)
  const handleDownloadBackground = async () => {
      const targetUrl = photoDownloadUrl || currentImage;
      if (!targetUrl) return;
      
      try {
          // Trigger download statistic tracking only on explicit save!
          if (photoDownloadLocation) {
              fetch('/api/background/download', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ downloadLocation: photoDownloadLocation })
              }).catch(() => {});
          }

          const response = await fetch(targetUrl);
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `LoreLens-Wallpaper-${Date.now()}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
          
          triggerHaptic();
      } catch (e) {
          console.error("Failed to download wallpaper", e);
          window.open(targetUrl, '_blank');
      }
  };

  // Logic to load content
  const loadContextContent = async (displayCity: string, displayDistrict: string = "", searchCity: string = "", searchDistrict: string = "") => {
      const finalSearchCity = searchCity || displayCity;
      const finalSearchDistrict = searchDistrict || displayDistrict;

      const cleanDisplayCity = displayCity.replace(/(City|Shi)$/i, '').trim();
      const cleanSearchCity = finalSearchCity.replace(/(City|Shi)$/i, '').trim();
      const cleanSearchDistrict = finalSearchDistrict.replace(/(District|New Area|County|Qu)$/i, '').trim();
      const timeCtx = getTimeContext();
      
      let displayLocationName = cleanDisplayCity;
      if (cleanDisplayCity === 'Beijing') {
          displayLocationName = FALLBACK_CITY_I18N[language];
      }

      // 1. Check Curated DB
      const cityData = INSIGHTS_DB.find(c => cleanSearchCity.includes(c.city) || c.city.includes(cleanSearchCity));
      
      let searchQuery = "";
      
      if (cityData) {
          // Use DB Content
          const selected = cityData.items[Math.floor(Math.random() * cityData.items.length)];
          
          if (language !== 'en') {
              const langTemplates = DYNAMIC_TEMPLATES[language] || DYNAMIC_TEMPLATES['en'];
              const template = langTemplates[Math.floor(Math.random() * langTemplates.length)];
              setInsight({
                  quote: template.quote.replace(/{city}/g, displayLocationName),
                  author: template.author,
                  title: template.title.replace(/{city}/g, displayLocationName),
                  keywords: selected.keywords
              });
          } else {
              setInsight(selected);
          }
          // Append time context to DB keywords for variety
          searchQuery = `${selected.keywords} ${timeCtx.timeQuery}`;
      } else {
          // Use Dynamic Fallback
          const langTemplates = DYNAMIC_TEMPLATES[language] || DYNAMIC_TEMPLATES['en'];
          const template = langTemplates[Math.floor(Math.random() * langTemplates.length)];
          
          setInsight({
              quote: template.quote.replace(/{city}/g, displayLocationName),
              author: template.author,
              title: template.title.replace(/{city}/g, displayLocationName),
              keywords: "" 
          });

          // Dynamic Search Term
          searchQuery = `${cleanSearchCity} ${cleanSearchDistrict} ${timeCtx.timeQuery} aesthetic street architecture`;
      }

      // 2. Fetch Image with a highly robust progressive search chain
      // We try from most specific to most general terms, ensuring we never hit the hard fallback unless absolutely offline.
      const queryList = [
          // A: Try the primary search query (either curated DB keywords + time, or city + district + time + aesthetic)
          searchQuery,
          // B: Try simpler dynamic search if primary fails (e.g. "Shenzhen Nanshan street")
          cleanSearchDistrict ? `${cleanSearchCity} ${cleanSearchDistrict} street` : null,
          // C: Try general city + current timeOfDay query (e.g. "Shenzhen night neon street")
          `${cleanSearchCity} ${timeCtx.timeQuery}`,
          // D: Try just the city name as a high-odds search (e.g. "Shenzhen")
          `${cleanSearchCity}`,
          // E: If the city is obscure and has zero pictures, search for gorgeous generic urban theme matching timeOfDay
          `cozy street ${timeCtx.timeQuery}`,
          `city architecture ${timeCtx.timeQuery} aesthetic`,
          // F: Absolute last resort atmospheric theme
          `cozy moody street light`
      ].filter((q): q is string => typeof q === 'string' && q.trim().length > 0);

      let imageLoadedSuccess = false;
      for (const query of queryList) {
          console.log(`Trying progressive Unsplash query: "${query}"`);
          imageLoadedSuccess = await fetchUnsplashPhoto(query);
          if (imageLoadedSuccess) {
              break;
          }
      }

      if (!imageLoadedSuccess) {
          setCurrentImage(FALLBACK_IMAGE);
          setPhotoCredit(FALLBACK_CREDIT);
      }
  };

  // Initial Load & Geolocation
  useEffect(() => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                // 1. 核心修复：只请求一次对应语言的地理位置，完全消除并发请求被 Nominatim rate limit 阻塞的问题！
                const localizedData = await fetch(`/api/nominatim/reverse?lat=${latitude}&lon=${longitude}&lang=${language}`).then(res => res.json());
                
                // 解析用于【显示】的本地化名称
                const locAddress = localizedData.address || {};
                const displayCity = locAddress.city || locAddress.town || locAddress.village || "Beijing";
                const displayDistrict = language === 'en' 
                    ? (locAddress.suburb || locAddress.district || "").replace(/(District|New Area|County|Qu)$/i, '').trim() 
                    : (locAddress.suburb || locAddress.district || "");

                // 使用本地字典对地名进行最完美的英文映射转换，提供给 Unsplash 获得极高命中率
                const searchCity = getEnglishCityName(displayCity);
                const searchDistrict = getEnglishCityName(displayDistrict);

                setCurrentCity(displayCity);
                setCurrentDistrict(displayDistrict);

                // 根据语言习惯拼接显示的地理位置
                let formattedLocation = displayCity;
                if (displayDistrict) {
                    if (language === 'ar') formattedLocation = `${displayDistrict}، ${displayCity}`;
                    else if (language === 'zh' || language === 'ja') formattedLocation = `${displayCity}${displayDistrict}`;
                    else formattedLocation = `${displayCity}, ${displayDistrict}`;
                }
                setLocationName(formattedLocation);
                
                // 2. 核心调用：使用高品质提取的翻译英文术语来进行背景墙纸抓取！
                loadContextContent(displayCity, displayDistrict, searchCity, searchDistrict);
            } catch (e) {
                console.warn("Geocoding failed, using fallback", e);
                setCurrentCity("Beijing");
                loadContextContent("Beijing", "", "Beijing", "");
            }
        }, (err) => {
             console.warn("Location permission denied", err);
             setCurrentCity("Beijing");
             loadContextContent("Beijing", "", "Beijing", "");
        }, { enableHighAccuracy: true });
    } else {
        setCurrentCity("Beijing");
        loadContextContent("Beijing", "", "Beijing", "");
    }
  }, [language]); 

  // Refresh greeting and insight text when Language changes
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? t('greeting.morning') : hour < 18 ? t('greeting.afternoon') : t('greeting.evening'));
    
    // Re-run insight generation (only for the text part if possible, but here we just re-run the whole lightweight logic)
    // We only re-run content loader if we have a city set, to avoid overwriting with defaults prematurely
    if (currentCity) {
         // To avoid re-fetching image constantly on language switch, we could separate text logic. 
         // But for simplicity, we just re-run. The browser caches the image URL usually if it's the same query result, 
         // but unsplash randomizes. 
         // Optimization: Only update text if it's a dynamic template.
         const cleanCity = currentCity.replace(/(City|Shi)$/i, '').trim();
         const cityData = INSIGHTS_DB.find(c => cleanCity.includes(c.city) || c.city.includes(cleanCity));
         
         let displayLocationName = cleanCity;
         if (cleanCity === 'Beijing' || cleanCity === 'بكين' || cleanCity === 'Пекин' || cleanCity === 'Pekín' || cleanCity === 'Pékin' || cleanCity === '北京') {
             displayLocationName = FALLBACK_CITY_I18N[language];
         } else {
             // If Nominatim gave us English while we requested another language, format it gracefully anyway
         }
         
         if (!cityData || language !== 'en') {
             // It is dynamic, so we MUST update the text to match new language
             const langTemplates = DYNAMIC_TEMPLATES[language] || DYNAMIC_TEMPLATES['en'];
             const template = langTemplates[Math.floor(Math.random() * langTemplates.length)];
             setInsight({
                  quote: template.quote.replace(/{city}/g, displayLocationName),
                  author: template.author,
                  title: template.title.replace(/{city}/g, displayLocationName),
                  keywords: insight.keywords || "" 
             });
         } else {
             // English and cityData exists
             const selected = cityData.items[Math.floor(Math.random() * cityData.items.length)];
             setInsight(selected);
         }
         
         // Fix locationName title above
         if (currentCity.includes('Beijing') || currentCity === 'بكين' || currentCity === 'Пекин' || currentCity === 'Pekín' || currentCity === 'Pékin' || currentCity === '北京') {
             // We want to translate "Beijing" within the location name if it exists, without losing the district.
             // Usually locationName might be "Chaoyang District, Beijing" or "Beijing, Chaoyang District"
             // But if we only have the city, we can just use the fallback.
             setLocationName(prev => {
                 return prev.replace(/(Beijing|بكين|Пекин|Pekín|Pékin|北京)/g, FALLBACK_CITY_I18N[language] || FALLBACK_CITY_I18N['en']);
             });
         }
    }
  }, [language, currentCity]);

  // Styles
  const cardBg = isDark ? 'bg-[#1c1c1e]/80 border-white/20' : 'bg-white/80 border-gray-200';
  const textMain = isDark ? 'text-white' : 'text-gray-900';
  const textSub = isDark ? 'text-gray-400' : 'text-gray-600';

  // Motion reduction animation helper classes
  const animFadeInUp = reduceMotion ? '' : 'animate-fade-in-up';
  const animFadeInUpDelay100 = reduceMotion ? '' : 'animate-fade-in-up delay-100';
  const animFadeInUpDelay200 = reduceMotion ? '' : 'animate-fade-in-up delay-200';
  const cardScaleHover = reduceMotion ? '' : 'transform transition-all duration-500 hover:scale-[1.02]';
  const pulseClass = reduceMotion ? '' : 'animate-pulse';

  return (
    <div className="absolute inset-0 z-20 overflow-hidden">
        {/* Dynamic Blurred Background Layer */}
        <div className="absolute inset-0 z-0 overflow-hidden">
            {currentImage && (
                <img 
                    src={currentImage} 
                    alt="Background" 
                    className="w-full h-full object-cover filter blur-[20px] scale-110 transition-all duration-1000 ease-in-out opacity-50"
                />
            )}
            {/* Contrast Overlay */}
            <div className={`absolute inset-0 transition-colors duration-700 ${isDark ? 'bg-black/60' : 'bg-white/60'}`} />
        </div>

      {/* Content Layer */}
      <div className="absolute inset-0 z-10 overflow-y-auto no-scrollbar">
        <div className="min-h-full flex flex-col justify-between">
            {/* Top Header */}
            <div className={`pt-12 px-6 ${animFadeInUp} shrink-0`}>
            <h1 className={`text-3xl font-light tracking-tight ${textMain}`}>
                {greeting}
            </h1>
            <div className="flex items-center gap-2 mt-1 opacity-80">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className={`text-sm font-medium truncate max-w-[200px] ${textMain}`}>{locationName}</span>
            </div>
            
            {/* Travel Journal Stats Bar */}
            <div className="mt-4 flex items-center gap-3">
              <div className={`px-3 py-1.5 rounded-full border text-xs font-mono flex items-center gap-2 backdrop-blur-md transition-all duration-300 ${isDark ? 'bg-white/5 border-white/10 text-white/90' : 'bg-black/5 border-black/10 text-black/95 shadow-sm'}`}>
                <span className={`w-2 h-2 rounded-full ${pulseClass} ${accent.bg}`} />
                <span className="font-light">{language === 'zh' ? '今日发现' : 'Today'}</span>
                <span className="font-bold">{todayDiscoveries}</span>
              </div>
              <div className={`px-3 py-1.5 rounded-full border text-xs font-mono flex items-center gap-2 backdrop-blur-md transition-all duration-300 ${isDark ? 'bg-white/5 border-white/10 text-white/90' : 'bg-black/5 border-black/10 text-black/95 shadow-sm'}`}>
                <span className="font-light">{language === 'zh' ? '累计日志' : 'Total Logs'}</span>
                <span className="font-bold">{totalDiscoveries}</span>
              </div>
            </div>
            </div>

            {/* Center: Daily Insight Card */}
            <div className="flex-1 flex items-center justify-center p-4 w-full max-w-md mx-auto my-2 shrink-0">
            <div className={`w-full rounded-[2rem] border shadow-2xl overflow-hidden ${cardScaleHover} ${animFadeInUpDelay100} ${cardBg} backdrop-blur-md relative`}>
                {/* Card Image */}
                <div className="h-52 bg-gray-900 relative overflow-hidden group">
                    {currentImage && (
                        <img 
                            src={currentImage}
                            alt="Local Context" 
                            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-700 group-hover:scale-105"
                        />
                    )}
                    <div className="absolute top-4 start-4 bg-black/30 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
                        <span className="text-xs font-bold text-white tracking-wider uppercase">{t('home.localInsight')}</span>
                    </div>
                    
                    {/* Unsplash Attribution with Save Wallpaper capability */}
                    {photoCredit && (
                        <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/85 to-transparent flex justify-between items-center z-10">
                            <button
                                onClick={handleDownloadBackground}
                                className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white hover:text-white transition-all flex items-center gap-1.5 active:scale-95"
                                title="Download Wallpaper"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-4-4m4 4l4-4" />
                                </svg>
                                <span className="text-[9px] font-semibold uppercase tracking-wider">Save</span>
                            </button>
                            <span className="text-[10px] text-white/70 font-light tracking-wide truncate max-w-[200px]">
                                {t('home.photoBy')} <a href={`${photoCredit.link}?utm_source=${APP_NAME}&utm_medium=referral`} target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">{photoCredit.name}</a> {t('home.on')} <a href={`https://unsplash.com/?utm_source=${APP_NAME}&utm_medium=referral`} target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">Unsplash</a>
                            </span>
                        </div>
                    )}
                </div>

                {/* Card Content */}
                <div className="p-5">
                    <div className="flex gap-4 mb-3">
                        <div className={`w-1 h-12 rounded-full ${accent.bg}`}></div>
                        <p className={`text-lg font-serif italic leading-relaxed ${textMain}`}>
                            "{insight.quote}"
                        </p>
                    </div>
                    <div className="flex justify-end">
                        <span className={`text-xs font-bold uppercase tracking-widest opacity-50 ${textSub}`}>— {insight.author}</span>
                    </div>
                </div>
            </div>
            </div>

            {/* Bottom Controls */}
            <div className={`pb-8 pt-4 px-8 flex items-center justify-between ${animFadeInUpDelay200} shrink-0`}>
            <button 
                onClick={onOpenHistory}
                className={`p-4 rounded-full transition-all active:scale-90 border backdrop-blur-md shadow-lg ${isDark ? 'bg-black/20 border-white/10 text-white hover:bg-black/40' : 'bg-white/40 border-white/40 text-gray-900 hover:bg-white/60'}`}
            >
                <IconHistory className="w-6 h-6" />
            </button>

            <div className="relative group flex flex-col items-center">
                <button 
                    onClick={onScanStart}
                    className="w-20 h-20 rounded-full border-[3px] border-white/40 flex items-center justify-center bg-white/10 backdrop-blur-md shadow-[0_0_30px_rgba(255,255,255,0.1)] active:scale-90 transition-all duration-300 group-hover:border-white/80"
                >
                    <IconCamera className="w-8 h-8 text-white" />
                </button>
                <span className="absolute -bottom-8 text-xs font-medium tracking-widest uppercase text-white/80 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    {t('home.scan')}
                </span>
            </div>

            <button 
                onClick={onOpenSettings}
                className={`p-4 rounded-full transition-all active:scale-90 border backdrop-blur-md shadow-lg ${isDark ? 'bg-black/20 border-white/10 text-white hover:bg-black/40' : 'bg-white/40 border-white/40 text-gray-900 hover:bg-white/60'}`}
            >
                <IconSettings className="w-6 h-6" />
            </button>
            </div>
        </div>
      </div>
    </div>
  );
}
