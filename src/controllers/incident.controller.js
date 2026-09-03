const IncidentReport = require('../models/IncidentReport');
const apiResponse = require('../utils/apiResponse');

const createIncident = async (req, res) => {
  try {
    const incident = await IncidentReport.create(req.body);

    return apiResponse.success(res, 201, 'Incident report created successfully', incident);
  } catch (err) {
    return apiResponse.error(res, 500, 'Failed to create incident report', err.message);
  }
};

const getIncidents = async (req, res) => {
  try {
    const incidents = await IncidentReport.find().populate('reportedBy');

    return apiResponse.success(res, 200, 'Incident reports fetched successfully', incidents);
  } catch (err) {
    return apiResponse.error(res, 500, 'Failed to fetch incident reports', err.message);
  }
};

module.exports = {
  createIncident,
  getIncidents,
};
