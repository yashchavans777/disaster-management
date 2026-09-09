const express = require('express');
const { translateText } = require('../utils/bhashini');
const apiResponse = require('../utils/apiResponse');

const router = express.Router();

/**
 * GET /api/translate?text=...&lang=...
 * Translates UI text strings on demand using Bhashini API with offline dictionary fallback.
 */
router.get('/', async (req, res) => {
  try {
    const text = req.query.text;
    const targetLang = req.query.lang || req.query.targetLang || 'hi';
    const sourceLang = req.query.source || req.query.sourceLang || 'en';

    if (!text || typeof text !== 'string') {
      return apiResponse.error(res, 400, 'Query parameter "text" is required');
    }

    const translatedText = await translateText(text, sourceLang, targetLang);

    return apiResponse.success(res, 200, 'Translation successful', {
      originalText: text,
      translatedText,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang,
    });
  } catch (err) {
    return apiResponse.error(res, 500, 'Translation failed', err.message);
  }
});

module.exports = router;
