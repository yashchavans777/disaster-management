/**
 * Incident controller with Agentic Workflow Loop.
 *
 * Agentic pipeline (triggered on every new incident):
 *   1. Incident created in MongoDB
 *   2. DL model recalculates risk score for the incident's location
 *   3. A* GIS service calculates optimal alternate route
 *   4. Socket.io broadcasts `route_hazard_alert` to all drivers
 *   5. If risk = high → creates a Notification for all assigned drivers
 */

const IncidentReport = require('../models/IncidentReport');
const Shipment = require('../models/Shipment');
const apiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');
const weatherService = require('../services/weather.service');
const aiRouteService = require('../services/aiRoute.service');
const gisService = require('../services/gis.service');
const notificationService = require('../services/notification.service');

// ── Agentic Orchestration ─────────────────────────────────────────────────────

/**
 * Build the human-readable voice alert message for a detected hazard.
 * Returns [englishMessage, hindiMessage].
 */
const buildAlertMessages = (incident, riskLevel) => {
  const type = incident.type || 'hazard';
  const lat = incident.location?.lat?.toFixed(4) || '—';
  const lng = incident.location?.lng?.toFixed(4) || '—';

  const english =
    `⚠️ ${riskLevel.toUpperCase()} RISK ALERT: ${type.charAt(0).toUpperCase()}${type.slice(1)} reported ` +
    `near coordinates (${lat}, ${lng}). Please follow the alternate route immediately.`;

  const hindi =
    `⚠️ ${type === 'landslide' ? 'भूस्खलन' : type === 'flood' ? 'बाढ़' : type === 'roadblock' ? 'सड़क अवरोध' : 'आपदा'} ` +
    `की सूचना मिली है। कृपया तुरंत वैकल्पिक मार्ग अपनाएं।`;

  return { english, hindi };
};

/**
 * Runs the full agentic pipeline after an incident is created.
 * Fire-and-forget — does NOT block the HTTP response.
 *
 * @param {import('mongoose').Document} incident
 * @param {import('express').Application} app - Express app (holds io instance)
 */
const runAgenticLoop = async (incident, app) => {
  try {
    const io = app.get('io');
    const lat = incident.location?.lat;
    const lng = incident.location?.lng;

    if (!lat || !lng) {
      logger.warn('[Agentic] Incident has no location — skipping agentic loop');
      return;
    }

    // Step 1: Fetch live weather at incident location
    let weatherData = {};
    try {
      weatherData = await weatherService.getWeatherData(lat, lng);
    } catch (weatherError) {
      logger.warn(`[Agentic] Weather fetch failed: ${weatherError.message} — using empty data`);
    }

    // Step 2: DL model predicts new risk score
    const riskLevel = await aiRouteService.calculateRouteRisk(weatherData, lat, lng);
    const riskScore = await aiRouteService.calculateRawRiskScore(weatherData, lat, lng);

    logger.info(`[Agentic] Incident at (${lat}, ${lng}) → risk: ${riskLevel} (score: ${riskScore})`);

    // Step 3: A* GIS calculates alternate route from nearest node
    const nearestOrigin = gisService.nearestNode([lat, lng]);
    const blockedEdges = new Set(); // future: populate from active incidents
    const alternateResult = gisService.aStarRoute(nearestOrigin, 'guwahati', blockedEdges);
    const alternateCoordinates = alternateResult ? gisService.pathToCoordinates(alternateResult.path) : [];

    // Step 4: Build messages
    const { english, hindi } = buildAlertMessages(incident, riskLevel);

    // Step 5: Broadcast via Socket.io to all driver clients
    if (io) {
      io.emit('route_hazard_alert', {
        incidentId: incident._id,
        riskLevel,
        riskScore,
        incidentType: incident.type,
        severity: incident.severity,
        location: { lat, lng },
        message: english,
        messageHindi: hindi,
        alternateRouteCoordinates: alternateCoordinates,
        alternateRoutePath: alternateResult?.path || [],
        alternateRouteKm: alternateResult?.totalKm || null,
        triggeredAt: new Date().toISOString(),
      });

      logger.info(`[Agentic] Broadcast route_hazard_alert to all sockets — risk: ${riskLevel}`);
    }

    // Step 6: If high/critical risk → notify all in-transit drivers
    if (riskLevel === 'high' || incident.severity === 'critical') {
      const activeShipments = await Shipment.find({
        status: { $in: ['in-transit', 'assigned'] },
        $or: [{ assignedDriver: { $ne: null } }, { driver: { $ne: null } }],
      }).select('assignedDriver driver origin destination');

      const driverIds = [
        ...new Set(
          activeShipments
            .map((s) => String(s.assignedDriver || s.driver))
            .filter((id) => id && id !== 'null')
        ),
      ];

      await Promise.allSettled(
        driverIds.map((driverId) =>
          notificationService.sendNotification({
            userId: driverId,
            message: english,
            type: 'alert',
            metadata: {
              incidentId: incident._id,
              riskLevel,
              riskScore,
              alternateRouteKm: alternateResult?.totalKm,
            },
          })
        )
      );

      logger.info(`[Agentic] Sent ${driverIds.length} driver notifications for high-risk incident`);
    }
  } catch (error) {
    logger.error(`[Agentic] Loop error: ${error.message}`);
  }
};

// ── Controller Functions ──────────────────────────────────────────────────────

const createIncident = async (req, res) => {
  try {
    const incident = await IncidentReport.create(req.body);

    // Fire agentic loop asynchronously — do NOT await so HTTP responds immediately
    setImmediate(() => runAgenticLoop(incident, req.app));

    return apiResponse.success(res, 201, 'Incident report created successfully', incident);
  } catch (err) {
    return apiResponse.error(res, 500, 'Failed to create incident report', err.message);
  }
};

const getIncidents = async (req, res) => {
  try {
    const incidents = await IncidentReport.find()
      .sort({ createdAt: -1 })
      .populate('reportedBy', 'name email');

    return apiResponse.success(res, 200, 'Incident reports fetched successfully', incidents);
  } catch (err) {
    return apiResponse.error(res, 500, 'Failed to fetch incident reports', err.message);
  }
};

module.exports = { createIncident, getIncidents };
