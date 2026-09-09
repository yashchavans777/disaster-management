let axios;
try {
  axios = require('axios');
} catch (err) {
  try {
    axios = require('../../frontend/node_modules/axios');
  } catch (err2) {
    // Native fetch fallback if axios module cannot be resolved
    axios = {
      post: async (url, data, config = {}) => {
        const headers = { 'Content-Type': 'application/json', ...(config.headers || {}) };
        const controller = new AbortController();
        const timeoutId = config.timeout ? setTimeout(() => controller.abort(), config.timeout) : null;
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(data),
            signal: controller.signal,
          });
          const json = await res.json();
          return { data: json, status: res.status };
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }
      },
    };
  }
}

const logger = require('./logger');

// Curated offline disaster & UI dictionary for Assamese ('as'), Bengali ('bn'), and Hindi ('hi')
// explicitly supporting remote low-network and offline field deployment in the North East Region
const OFFLINE_DICTIONARY = {
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
    'Weather Forecast': 'मौसम का पूर्वानुमान',
    'Hazard detected ahead. Follow the alternate route.': 'आगे खतरा है। कृपया वैकल्पिक सुरक्षित मार्ग का पालन करें।',
    'High risk alert detected on relief corridor. Reroute advised.': 'राहत गलियारे पर उच्च जोखिम का पता चला है। मार्ग बदलने की सलाह दी जाती है।',
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
    'Weather Forecast': 'বতৰৰ পূৰ্বাভাস',
    'Hazard detected ahead. Follow the alternate route.': 'আগতে বিপদ ধৰা পৰিছে। অনুগ্ৰহ কৰি বিকল্প নিৰাপদ পথ অনুসৰণ কৰক।',
    'High risk alert detected on relief corridor. Reroute advised.': 'সাহায্য কৰিডৰত উচ্চ বিপদৰ সংকেত। পথ সলনি কৰিবলৈ পৰামৰ্শ দিয়া হৈছে।',
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
    'Weather Forecast': 'আবহাওয়ার পূর্বাভাস',
    'Hazard detected ahead. Follow the alternate route.': 'সামনে বিপদের আশঙ্কা। অনুগ্রহ করে বিকল্প নিরাপদ রুট অনুসরণ করুন।',
    'High risk alert detected on relief corridor. Reroute advised.': 'ত্রাণ করিডোরে উচ্চ ঝুঁকির সতর্কতা জারি। রুট পরিবর্তনের পরামর্শ দেওয়া হচ্ছে।',
  },
};

/**
 * Translates text using Government of India's Bhashini (ULCA NMT) pipeline.
 * Securely reads process.env.BHASHINI_API_KEY and process.env.BHASHINI_USER_ID.
 * Gracefully falls back to offline dictionary or original English text on network failure/timeout.
 *
 * @param {string} text - Text to translate
 * @param {string} [sourceLang='en'] - Source language code (e.g., 'en')
 * @param {string} [targetLang='hi'] - Target language code ('hi', 'as', 'bn')
 * @returns {Promise<string>} Translated string or fallback text
 */
async function translateText(text, sourceLang = 'en', targetLang = 'hi') {
  if (!text || typeof text !== 'string') return text || '';

  const sLang = (sourceLang || 'en').toLowerCase().trim();
  const tLang = (targetLang || 'en').toLowerCase().trim();

  // If source and target language are identical, return immediately
  if (sLang === tLang) {
    return text;
  }

  const apiKey = (process.env.BHASHINI_API_KEY || '').trim();
  const userId = (process.env.BHASHINI_USER_ID || '').trim();
  const pipelineUrl =
    process.env.BHASHINI_PIPELINE_URL ||
    'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';

  // Check offline dictionary first for ultra-fast response and zero-network resilience
  const dictTarget = OFFLINE_DICTIONARY[tLang];
  const dictionaryMatch = dictTarget ? dictTarget[text.trim()] : null;

  // If no credentials configured, use offline verified dictionary or fallback to original text
  if (!apiKey || !userId) {
    if (dictionaryMatch) {
      return dictionaryMatch;
    }
    return text;
  }

  try {
    const payload = {
      pipelineTasks: [
        {
          taskType: 'translation',
          config: {
            language: {
              sourceLanguage: sLang,
              targetLanguage: tLang,
            },
          },
        },
      ],
      inputData: {
        input: [
          {
            source: text,
          },
        ],
      },
    };

    const headers = {
      'Content-Type': 'application/json',
      Authorization: apiKey,
      userID: userId,
      ulcaApiKey: apiKey,
    };

    const response = await axios.post(pipelineUrl, payload, {
      headers,
      timeout: 5000, // 5s timeout to simulate/handle low-network conditions gracefully
    });

    const translated =
      response.data?.pipelineResponse?.[0]?.output?.[0]?.target ||
      response.data?.output?.[0]?.target ||
      response.data?.data?.[0]?.target;

    if (translated && typeof translated === 'string') {
      return translated.trim();
    }

    // Fallback if target output missing
    return dictionaryMatch || text;
  } catch (err) {
    logger.warn(
      `Bhashini API request failed (${err.message}). Gracefully falling back for '${tLang}'.`
    );
    // Graceful fallback to verified offline dictionary or original English text
    return dictionaryMatch || text;
  }
}

module.exports = {
  translateText,
  OFFLINE_DICTIONARY,
};
