/**
 * AI Controller.
 * Proxies requests from the React frontend → FastAPI AI microservice.
 * Falls back to the Node.js DL model if FastAPI is unavailable.
 */

const weatherService = require('../services/weather.service');
const aiRouteService = require('../services/aiRoute.service');
const gisService = require('../services/gis.service');
const IncidentReport = require('../models/IncidentReport');
const apiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

/**
 * POST /api/ai/predict-risk
 * Calls FastAPI /predict-risk; falls back to Node.js DL model.
 */
const predictRisk = async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (lat === undefined || lng === undefined) {
      return apiResponse.error(res, 400, 'lat and lng are required');
    }

    const weatherData = await weatherService.getWeatherData(lat, lng);

    // Try FastAPI first
    try {
      const fastapiRes = await fetch(`${FASTAPI_URL}/predict-risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, weather: weatherData }),
        signal: AbortSignal.timeout(4000),
      });

      if (fastapiRes.ok) {
        const data = await fastapiRes.json();
        return apiResponse.success(
          res,
          200,
          'Risk predicted by FastAPI AI service',
          data
        );
      }
    } catch (_) {
      logger.warn('FastAPI unavailable — falling back to Node.js DL model');
    }

    // Node.js DL fallback
    const riskLevel = await aiRouteService.calculateRouteRisk(
      weatherData,
      lat,
      lng
    );
    const riskScore = await aiRouteService.calculateRawRiskScore(
      weatherData,
      lat,
      lng
    );

    return apiResponse.success(
      res,
      200,
      'Risk predicted by Node.js DL model (FastAPI fallback)',
      {
        risk_level: riskLevel,
        risk_score: riskScore,
        weather: weatherData,
        source: 'node-dl-fallback',
      }
    );
  } catch (error) {
    logger.error(`predictRisk error: ${error.message}`);
    return apiResponse.error(res, 500, 'Risk prediction failed', error.message);
  }
};

/**
 * POST /api/ai/rag-query
 * RAG pipeline: retrieves recent incidents from DB, builds LLM context,
 * and calls FastAPI /rag-query. Falls back to local summarisation.
 */
const ragQuery = async (req, res) => {
  try {
    const { question } = req.body;

    if (
      !question ||
      typeof question !== 'string' ||
      question.trim().length < 3
    ) {
      return apiResponse.error(res, 400, 'question (string) is required');
    }

    // ── Retrieve recent incidents (RAG context) ─────────────────────────────
    const recentIncidents = await IncidentReport.find()
      .sort({ createdAt: -1 })
      .limit(15)
      .select('type title description severity location status createdAt')
      .lean();

    const context = recentIncidents
      .map(
        (inc) =>
          `[${inc.createdAt?.toISOString?.() || 'unknown time'}] ` +
          `Type: ${inc.type}, Severity: ${inc.severity}, Status: ${inc.status}. ` +
          `Location: (${inc.location?.lat?.toFixed(4)}, ${inc.location?.lng?.toFixed(4)}). ` +
          `Description: ${inc.description}`
      )
      .join('\n');

    // Try FastAPI RAG endpoint
    try {
      const fastapiRes = await fetch(`${FASTAPI_URL}/rag-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          context,
          incident_count: recentIncidents.length,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (fastapiRes.ok) {
        const data = await fastapiRes.json();
        return apiResponse.success(
          res,
          200,
          'RAG query answered by FastAPI',
          data
        );
      }
    } catch (_) {
      logger.warn('FastAPI RAG unavailable — using local summariser');
    }

    // ── Local RAG fallback — rule-based answer generation ───────────────────
    const answer = buildLocalRagAnswer(question.trim(), recentIncidents);

    return apiResponse.success(res, 200, 'RAG query answered locally', {
      question: question.trim(),
      answer,
      context_incidents: recentIncidents.length,
      source: 'local-rag-fallback',
    });
  } catch (error) {
    logger.error(`ragQuery error: ${error.message}`);
    return apiResponse.error(res, 500, 'RAG query failed', error.message);
  }
};

/**
 * Local rule-based RAG answer builder.
 * Performs keyword extraction and aggregation over retrieved incidents.
 */
const buildLocalRagAnswer = (question, incidents) => {
  const q = question.toLowerCase();

  if (!incidents.length) {
    return 'No recent incidents found in the database to answer your question.';
  }

  const total = incidents.length;
  const bySeverity = {};
  const byType = {};
  const byStatus = {};

  for (const inc of incidents) {
    bySeverity[inc.severity] = (bySeverity[inc.severity] || 0) + 1;
    byType[inc.type] = (byType[inc.type] || 0) + 1;
    byStatus[inc.status] = (byStatus[inc.status] || 0) + 1;
  }

  if (q.includes('roadblock') || q.includes('road block')) {
    const count = byType['roadblock'] || 0;
    return `There are ${count} roadblock incident(s) in the last ${total} reports. ${count > 0 ? 'Affected routes should be flagged for rerouting.' : 'No active roadblocks detected.'}`;
  }

  if (q.includes('flood')) {
    const count = byType['flood'] || byType['flooding'] || 0;
    return `${count} flooding incident(s) reported recently. ${count > 2 ? 'Critical: Multiple flood zones detected. Rerouting recommended for all NER deliveries.' : 'Situation appears manageable.'}`;
  }

  if (q.includes('landslide')) {
    const count = byType['landslide'] || 0;
    return `${count} landslide incident(s) in the recent data. Landslides are highest risk for the Guwahati–Shillong and Kohima corridors during monsoon season.`;
  }

  if (q.includes('high') || q.includes('critical') || q.includes('severe')) {
    const high = (bySeverity['high'] || 0) + (bySeverity['critical'] || 0);
    return `${high} high/critical severity incidents in the last ${total} reports. Breakdown: High=${bySeverity['high'] || 0}, Critical=${bySeverity['critical'] || 0}, Medium=${bySeverity['medium'] || 0}.`;
  }

  if (
    q.includes('status') ||
    q.includes('unresolved') ||
    q.includes('active')
  ) {
    const unresolved =
      (byStatus['active'] || 0) +
      (byStatus['reported'] || 0) +
      (byStatus['verified'] || 0);
    return `${unresolved} of the last ${total} incidents remain unresolved (active/reported/verified). ${byStatus['resolved'] || 0} have been resolved.`;
  }

  // Generic summary
  const topType = Object.entries(byType).sort(([, a], [, b]) => b - a)[0];
  return (
    `Summary of last ${total} incidents: Most common type is "${topType?.[0] || 'unknown'}" (${topType?.[1] || 0} reports). ` +
    `Severity breakdown — High: ${bySeverity['high'] || 0}, Medium: ${bySeverity['medium'] || 0}, Low: ${bySeverity['low'] || 0}, Critical: ${bySeverity['critical'] || 0}. ` +
    `Status — Active: ${byStatus['active'] || 0}, Reported: ${byStatus['reported'] || 0}, Resolved: ${byStatus['resolved'] || 0}.`
  );
};

/**
 * POST /api/ai/graph-route
 * A* pathfinding over NER graph.
 */
const graphRoute = async (req, res) => {
  try {
    const { origin, destination } = req.body;

    if (!origin || !destination) {
      return apiResponse.error(
        res,
        400,
        'origin and destination city slugs are required'
      );
    }

    const result = gisService.aStarRoute(
      origin.toLowerCase(),
      destination.toLowerCase()
    );

    if (!result) {
      return apiResponse.error(
        res,
        404,
        `No route found between "${origin}" and "${destination}"`
      );
    }

    const coordinates = gisService.pathToCoordinates(result.path);

    return apiResponse.success(res, 200, 'Route calculated', {
      path: result.path,
      totalKm: result.totalKm,
      coordinates,
    });
  } catch (error) {
    logger.error(`graphRoute error: ${error.message}`);
    return apiResponse.error(
      res,
      500,
      'Route calculation failed',
      error.message
    );
  }
};

module.exports = { predictRisk, ragQuery, graphRoute };
