const express = require('express');
const apiResponse = require('../utils/apiResponse');
const Shipment = require('../models/Shipment');
const IncidentReport = require('../models/IncidentReport');
const Notification = require('../models/Notification');

const router = express.Router();

/**
 * GET /api/dashboard/stats
 * Returns aggregated counts for the dashboard summary cards.
 */
router.get('/stats', async (req, res) => {
  try {
    const [
      totalShipments,
      activeShipments,
      totalIncidents,
      unresolvedIncidents,
      unreadNotifications,
    ] = await Promise.all([
      Shipment.countDocuments(),
      Shipment.countDocuments({ status: { $in: ['in-transit', 'assigned'] } }),
      IncidentReport.countDocuments(),
      IncidentReport.countDocuments({
        status: { $in: ['active', 'reported', 'verified'] },
      }),
      Notification.countDocuments({ read: { $ne: true } }),
    ]);

    return apiResponse.success(res, 200, 'Dashboard stats fetched', {
      totalShipments,
      activeShipments,
      totalIncidents,
      unresolvedIncidents,
      unreadNotifications,
    });
  } catch (error) {
    return apiResponse.error(
      res,
      500,
      'Failed to fetch dashboard stats',
      error.message
    );
  }
});

/**
 * GET /api/dashboard/shipment-status-chart
 * Returns shipment counts grouped by status for Recharts.
 */
router.get('/shipment-status-chart', async (req, res) => {
  try {
    const counts = await Shipment.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const chartData = counts.map(({ _id, count }) => ({ status: _id, count }));

    return apiResponse.success(
      res,
      200,
      'Shipment chart data fetched',
      chartData
    );
  } catch (error) {
    return apiResponse.error(
      res,
      500,
      'Failed to fetch chart data',
      error.message
    );
  }
});

/**
 * GET /api/dashboard/incident-trend
 * Returns incident counts per day for the last 7 days.
 */
router.get('/incident-trend', async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const trend = await IncidentReport.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const trendData = trend.map(({ _id, count }) => ({
      date: _id,
      incidents: count,
    }));

    return apiResponse.success(res, 200, 'Incident trend fetched', trendData);
  } catch (error) {
    return apiResponse.error(
      res,
      500,
      'Failed to fetch incident trend',
      error.message
    );
  }
});

module.exports = router;
