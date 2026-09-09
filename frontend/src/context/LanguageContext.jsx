import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import apiClient from '../api/apiClient';

const LANGUAGE_STORAGE_KEY = 'dm-bhashini-selected-language';
const CACHE_PREFIX = 'dm-bhashini-trans';

// Supported Bhashini language options: English ('en'), Hindi ('hi'), Assamese ('as'), Bengali ('bn')
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi', nativeName: 'हिंदी', flag: '🇮🇳' },
  { code: 'as', label: 'Assamese', nativeName: 'অসমীয়া', flag: '🇮🇳' },
  { code: 'bn', label: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳' },
];

// Curated offline disaster & UI dictionary providing zero-latency translations in remote areas
export const STATIC_DICTIONARY = {
  hi: {
    'Report Incident': 'घटना की रिपोर्ट करें',
    'Evaluate Route Risks': 'मार्ग जोखिम का मूल्यांकन करें',
    'Evaluate Route Risks (DL)': 'मार्ग जोखिम का मूल्यांकन करें (डीएल)',
    'Find Safe Route': 'सुरक्षित मार्ग खोजें',
    'Safe Route Planner': 'सुरक्षित मार्ग योजनाकार',
    'Hazard Zones': 'खतरा क्षेत्र',
    'High Risk: Flood Zone': 'उच्च जोखिम: बाढ़ क्षेत्र',
    'High Risk: Landslide Zone': 'उच्च जोखिम: भूस्खलन क्षेत्र',
    'Dashboard': 'डैशबोर्ड',
    'Driver View': 'चालक दृश्य',
    'Active Vehicle Map': 'सक्रिय वाहन मानचित्र',
    'District Connectivity Matrix': 'जिला कनेक्टिविटी मैट्रिक्स',
    'Hyper-Local City View': 'अति-स्थानीय नगर दृश्य',
    'Shipment Analytics': 'लॉजिस्टिक्स विश्लेषण',
    'Weather Forecast': 'मौसम का पूर्वानुमान',
    'Control Center': 'नियंत्रण केंद्र',
    'Sign In (Login)': 'साइन इन (लॉगिन)',
    'Sign Up (Register)': 'साइन अप (रजिस्टर)',
    'User Profile': 'उपयोगकर्ता प्रोफ़ाइल',
    'Sign out': 'साइन आउट',
    'Refreshing...': 'ताज़ा हो रहा है...',
    'Refresh': 'ताज़ा करें',
    'Start Location': 'प्रारंभिक स्थान',
    'End Location': 'गंतव्य स्थान',
    'Allowed': 'अनुमति प्राप्त',
    'Monitoring active relief vehicles across the North Eastern Region of India.': 'पूर्वोत्तर भारत में सक्रिय राहत वाहनों की निगरानी।',
  },
  as: {
    'Report Incident': 'দুৰ্ঘটনাৰ প্ৰতিবেদন দিয়ক',
    'Evaluate Route Risks': 'পথৰ বিপদ মূল্যায়ন কৰক',
    'Evaluate Route Risks (DL)': 'পথৰ বিপদ মূল্যায়ন কৰক (ডিএল)',
    'Find Safe Route': 'নিৰাপদ পথ বিচাৰক',
    'Safe Route Planner': 'নিৰাপদ পথ পৰিকল্পনাকাৰী',
    'Hazard Zones': 'বিপদজনক অঞ্চল',
    'High Risk: Flood Zone': 'উচ্চ বিপদ: বানপানী অঞ্চল',
    'High Risk: Landslide Zone': 'উচ্চ বিপদ: ভূমিস্খলন অঞ্চল',
    'Dashboard': 'ডেচবৰ্ড',
    'Driver View': 'চালকৰ দৃশ্য',
    'Active Vehicle Map': 'সক্ৰিয় বাহন মানচিত্ৰ',
    'District Connectivity Matrix': 'জিলা সংযোগ মেট্ৰিক্স',
    'Hyper-Local City View': 'স্থানীয় নগৰ দৃশ্য',
    'Shipment Analytics': 'পৰিবহণ বিশ্লেষণ',
    'Weather Forecast': 'বতৰৰ পূৰ্বাভাস',
    'Control Center': 'নিয়ন্ত্ৰণ কেন্দ্ৰ',
    'Sign In (Login)': 'ছাইন ইন (লগইন)',
    'Sign Up (Register)': 'ছাইন আপ (পঞ্জীয়ন)',
    'User Profile': 'ব্যৱহাৰকাৰী প্ৰফাইল',
    'Sign out': 'ছাইন আউট',
    'Refreshing...': 'সতেজ কৰা হৈছে...',
    'Refresh': 'সতেজ কৰক',
    'Start Location': 'আৰম্ভণিৰ স্থান',
    'End Location': 'গন্তব্য স্থান',
    'Allowed': 'অনুমোদিত',
    'Monitoring active relief vehicles across the North Eastern Region of India.': 'উত্তৰ-পূব ভাৰতত সক্ৰিয় সাহায্য বাহনসমূহৰ নিৰীক্ষণ।',
  },
  bn: {
    'Report Incident': 'ঘটনা রিপোর্ট করুন',
    'Evaluate Route Risks': 'পথের ঝুঁকি মূল্যায়ন করুন',
    'Evaluate Route Risks (DL)': 'পথের ঝুঁকি মূল্যায়ন করুন (ডিএল)',
    'Find Safe Route': 'নিরাপদ পথ খুঁজুন',
    'Safe Route Planner': 'নিরাপদ রুট পরিকল্পনাকারী',
    'Hazard Zones': 'ঝুঁকিপূর্ণ অঞ্চল',
    'High Risk: Flood Zone': 'উচ্চ ঝুঁকি: বন্যা অঞ্চল',
    'High Risk: Landslide Zone': 'উচ্চ ঝুঁকি: ভূমিধস অঞ্চল',
    'Dashboard': 'ড্যাশবোর্ড',
    'Driver View': 'চালক ভিউ',
    'Active Vehicle Map': 'সক্রিয় যানবাহন মানচিত্র',
    'District Connectivity Matrix': 'জেলা সংযোগ ম্যাট্রিক্স',
    'Hyper-Local City View': 'হাইপার-লোকাল শহর দৃশ্য',
    'Shipment Analytics': 'লজিস্টিক বিশ্লেষণ',
    'Weather Forecast': 'আবহাওয়ার পূর্বাভাস',
    'Control Center': 'নিয়ন্ত্রণ কেন্দ্র',
    'Sign In (Login)': 'সাইন ইন (লগইন)',
    'Sign Up (Register)': 'সাইন আপ (নিবন্ধন)',
    'User Profile': 'ব্যবহারকারী প্রোফাইল',
    'Sign out': 'সাইন আউট',
    'Refreshing...': 'রিফ্রেশ হচ্ছে...',
    'Refresh': 'রিফ্রেশ',
    'Start Location': 'শুরুর স্থান',
    'End Location': 'গন্তব্য স্থান',
    'Allowed': 'অনুমোদিত',
    'Monitoring active relief vehicles across the North Eastern Region of India.': 'উত্তর-পূর্ব ভারতে সক্রিয় ত্রাণ যানবাহনের রিয়েল-টাইম পর্যবেক্ষণ।',
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  // Global language state (default: 'en')
  const [selectedLanguage, setSelectedLanguageState] = useState(() => {
    try {
      return localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en';
    } catch {
      return 'en';
    }
  });

  // Memory map of dynamic translations for instant re-render
  const [dynamicCache, setDynamicCache] = useState({});

  const setSelectedLanguage = useCallback((langCode) => {
    const valid = SUPPORTED_LANGUAGES.some((l) => l.code === langCode);
    const newLang = valid ? langCode : 'en';
    setSelectedLanguageState(newLang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
    } catch {}
  }, []);

  /**
   * Generic translateUI(text) function.
   * Calls GET /api/translate?text=...&lang=...
   * Caches the result in localStorage / sessionStorage to fulfill
   * the "offline/low-network" fallback requirement.
   */
  const translateUI = useCallback(
    async (text) => {
      if (!text || typeof text !== 'string') return text || '';
      if (selectedLanguage === 'en') return text;

      const trimmed = text.trim();
      const cacheKey = `${CACHE_PREFIX}:${selectedLanguage}:${trimmed}`;

      // 1. Check localStorage or sessionStorage cache first
      try {
        const localCached =
          localStorage.getItem(cacheKey) || sessionStorage.getItem(cacheKey);
        if (localCached) {
          return localCached;
        }
      } catch (e) {
        console.warn('Storage read warning:', e);
      }

      // 2. Check offline pre-cached static dictionary
      const staticMatch = STATIC_DICTIONARY[selectedLanguage]?.[trimmed];

      // 3. Call backend GET /api/translate?text=...&lang=...
      try {
        const response = await apiClient.get('/translate', {
          params: { text: trimmed, lang: selectedLanguage },
          timeout: 4000, // 4s timeout for graceful low-network handling
        });

        const translated = response.data?.data?.translatedText;
        if (translated && typeof translated === 'string') {
          try {
            localStorage.setItem(cacheKey, translated);
          } catch {}
          setDynamicCache((prev) => ({
            ...prev,
            [`${selectedLanguage}:${trimmed}`]: translated,
          }));
          return translated;
        }
      } catch (err) {
        console.warn('Translate API call offline/failed, using fallback:', err.message);
      }

      // 4. Gracefully fall back to static verified dictionary or English
      const fallback = staticMatch || trimmed;
      try {
        localStorage.setItem(cacheKey, fallback);
      } catch {}
      return fallback;
    },
    [selectedLanguage]
  );

  /**
   * Synchronous translation helper t(text) for immediate JSX rendering.
   * Checks dynamic memory cache -> localStorage -> offline static dictionary -> English.
   * If translation is missing from dynamic cache, triggers translateUI in background.
   */
  const t = useCallback(
    (text) => {
      if (!text || typeof text !== 'string') return text || '';
      if (selectedLanguage === 'en') return text;

      const trimmed = text.trim();
      const memoryKey = `${selectedLanguage}:${trimmed}`;

      if (dynamicCache[memoryKey]) {
        return dynamicCache[memoryKey];
      }

      const cacheKey = `${CACHE_PREFIX}:${selectedLanguage}:${trimmed}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          return cached;
        }
      } catch {}

      const staticMatch = STATIC_DICTIONARY[selectedLanguage]?.[trimmed];
      if (staticMatch) {
        return staticMatch;
      }

      // Trigger background translation for future renders
      translateUI(trimmed).catch(() => {});
      return text;
    },
    [selectedLanguage, dynamicCache, translateUI]
  );

  const value = useMemo(
    () => ({
      selectedLanguage,
      setSelectedLanguage,
      translateUI,
      t,
      languages: SUPPORTED_LANGUAGES,
    }),
    [selectedLanguage, setSelectedLanguage, translateUI, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export default LanguageContext;
