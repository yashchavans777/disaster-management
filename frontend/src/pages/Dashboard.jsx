import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import apiClient from '../api/apiClient';
import MapViewer from '../components/MapViewer';

const SHIPMENTS_CACHE_KEY = 'dm-shipments-cache';
const INCIDENT_QUEUE_KEY = 'dm-offline-incident-queue';

const locationCoordinates = {
  guwahati: [26.1445, 91.7362],
  shillong: [25.5788, 91.8933],
  itanagar: [27.0844, 93.6053],
  imphal: [24.817, 93.9368],
  agartala: [23.8315, 91.2868],
  aizawl: [23.7271, 92.7176],
  kohima: [25.6751, 94.1086],
  gangtok: [27.3389, 88.6065],
  silchar: [24.8333, 92.7789],
  dibrugarh: [27.4728, 94.912],
};

const normalizeLocationKey = (value = '') => value.trim().toLowerCase();

const getCoordinatesFromValue = (value) => {
  if (Array.isArray(value) && value.length >= 2) {
    const [latitude, longitude] = value;
    return [Number(latitude), Number(longitude)];
  }

  if (value && typeof value === 'object') {
    const latitude = value.latitude ?? value.lat;
    const longitude = value.longitude ?? value.lng ?? value.lon;

    if (latitude !== undefined && longitude !== undefined) {
      return [Number(latitude), Number(longitude)];
    }
  }

  if (typeof value === 'string') {
    return locationCoordinates[normalizeLocationKey(value)] ?? null;
  }

  return null;
};

const buildVehicleCoordinates = (shipment, originCoordinates, destinationCoordinates) => {
  const vehicleLocation =
    getCoordinatesFromValue(shipment?.currentLocation) ||
    getCoordinatesFromValue(shipment?.location) ||
    getCoordinatesFromValue(shipment?.assignedVehicle?.currentLocation) ||
    getCoordinatesFromValue(shipment?.assignedVehicle?.location) ||
    getCoordinatesFromValue(shipment?.vehicle?.currentLocation) ||
    getCoordinatesFromValue(shipment?.vehicle?.location);

  if (vehicleLocation) {
    return vehicleLocation;
  }

  if (originCoordinates && destinationCoordinates) {
    return [
      Number(((originCoordinates[0] + destinationCoordinates[0]) / 2).toFixed(4)),
      Number(((originCoordinates[1] + destinationCoordinates[1]) / 2).toFixed(4)),
    ];
  }

  return originCoordinates || destinationCoordinates || null;
};

const mapShipmentsToVehicles = (shipments) =>
  shipments
    .map((shipment) => {
      const originCoordinates = getCoordinatesFromValue(shipment.originCoordinates) || getCoordinatesFromValue(shipment.origin);
      const destinationCoordinates =
        getCoordinatesFromValue(shipment.destinationCoordinates) || getCoordinatesFromValue(shipment.destination);
      const vehicleCoordinates = buildVehicleCoordinates(shipment, originCoordinates, destinationCoordinates);

      if (!vehicleCoordinates) {
        return null;
      }

      const driver = shipment.assignedDriver || shipment.driver;
      const vehicle = shipment.assignedVehicle || shipment.vehicle;

      return {
        id: shipment._id,
        vehicleId: vehicle?._id,
        trackingId: shipment.trackingId,
        name:
          vehicle?.name ||
          vehicle?.vehicleNumber ||
          vehicle?.registrationNumber ||
          `${shipment.origin} → ${shipment.destination}`,
        latitude: vehicleCoordinates[0],
        longitude: vehicleCoordinates[1],
        status: shipment.status,
        driverName: driver?.name || driver?.fullName || 'Unassigned',
      };
    })
    .filter(Boolean);

const mapShipmentsToRoutes = (shipments) =>
  shipments
    .map((shipment) => {
      const routeCoordinates =
        shipment.routeCoordinates || shipment.route?.coordinates || shipment.route?.path || shipment.coordinates;

      const normalizedRouteCoordinates = Array.isArray(routeCoordinates)
        ? routeCoordinates
            .map((coordinate) => getCoordinatesFromValue(coordinate))
            .filter(Boolean)
        : [];

      const originCoordinates = getCoordinatesFromValue(shipment.originCoordinates) || getCoordinatesFromValue(shipment.origin);
      const destinationCoordinates =
        getCoordinatesFromValue(shipment.destinationCoordinates) || getCoordinatesFromValue(shipment.destination);

      const coordinates =
        normalizedRouteCoordinates.length >= 2
          ? normalizedRouteCoordinates
          : [originCoordinates, destinationCoordinates].filter(Boolean);

      if (coordinates.length < 2) {
        return null;
      }

      return {
        id: shipment._id,
        shipmentId: shipment._id,
        coordinates,
        riskLevel: shipment.route?.riskLevel || shipment.riskLevel || 'low',
        label: `${shipment.origin} → ${shipment.destination}`,
      };
    })
    .filter(Boolean);

const buildAlternateRoute = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return [];
  }

  const midpointIndex = Math.floor((coordinates.length - 1) / 2);
  const midpoint = coordinates[midpointIndex];

  if (!midpoint) {
    return coordinates;
  }

  const alternateMidpoint = [
    Number((midpoint[0] + 0.18).toFixed(4)),
    Number((midpoint[1] + 0.22).toFixed(4)),
  ];

  return [coordinates[0], alternateMidpoint, coordinates[coordinates.length - 1]];
};

const readCachedShipments = () => {
  try {
    const cachedValue = localStorage.getItem(SHIPMENTS_CACHE_KEY);

    if (!cachedValue) {
      return [];
    }

    const parsedValue = JSON.parse(cachedValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
};

const cacheShipments = (shipments) => {
  localStorage.setItem(SHIPMENTS_CACHE_KEY, JSON.stringify(shipments));
};

const readQueuedIncidents = () => {
  try {
    const cachedValue = localStorage.getItem(INCIDENT_QUEUE_KEY);

    if (!cachedValue) {
      return [];
    }

    const parsedValue = JSON.parse(cachedValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
};

const writeQueuedIncidents = (incidents) => {
  localStorage.setItem(INCIDENT_QUEUE_KEY, JSON.stringify(incidents));
};

const buildLandslideIncidentPayload = () => ({
  type: 'landslide',
  title: 'Landslide reported from dashboard',
  description: 'Field worker reported a landslide blocking a relief corridor. Requires route review.',
  severity: 'high',
  location: {
    lat: 25.5788,
    lng: 91.8933,
    address: 'Shillong Bypass, Meghalaya',
  },
  status: 'reported',
});

function Dashboard() {
  const [shipments, setShipments] = useState(() => readCachedShipments());
  const [isLoading, setIsLoading] = useState(() => readCachedShipments().length === 0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isEvaluatingRisk, setIsEvaluatingRisk] = useState(false);
  const [routeRiskResults, setRouteRiskResults] = useState({});
  const [isSubmittingIncident, setIsSubmittingIncident] = useState(false);

  const fetchShipments = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');

      const response = await apiClient.get('/shipments');
      const shipmentData = Array.isArray(response.data?.data) ? response.data.data : [];

      setShipments(shipmentData);
      cacheShipments(shipmentData);
      setRouteRiskResults({});

      return shipmentData;
    } catch (error) {
      const cachedShipments = readCachedShipments();
      setShipments(cachedShipments);
      setErrorMessage(error.response?.data?.message || 'Failed to load active shipments.');
      return cachedShipments;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncOfflineIncidents = useCallback(async () => {
    const queuedIncidents = readQueuedIncidents();

    if (!queuedIncidents.length) {
      await fetchShipments();
      return;
    }

    const failedIncidents = [];

    for (const incident of queuedIncidents) {
      try {
        await apiClient.post('/incidents', incident);
      } catch {
        failedIncidents.push(incident);
      }
    }

    writeQueuedIncidents(failedIncidents);

    if (failedIncidents.length === 0) {
      toast.success('Offline incident reports synced successfully.');
    } else {
      toast.error('Some offline incident reports could not be synced yet.');
    }

    await fetchShipments();
  }, [fetchShipments]);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  useEffect(() => {
    const handleOffline = () => {
      toast('You are offline. Data is cached locally.', {
        icon: '📡',
      });
    };

    const handleOnline = async () => {
      toast.success('Back online! Syncing data...');
      await syncOfflineIncidents();
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [syncOfflineIncidents]);

  const activeShipments = useMemo(
    () => shipments.filter((shipment) => shipment.status !== 'delivered'),
    [shipments]
  );

  const activeVehicles = useMemo(() => mapShipmentsToVehicles(activeShipments), [activeShipments]);
  const shipmentRoutes = useMemo(() => mapShipmentsToRoutes(activeShipments), [activeShipments]);
  const activeRoutes = useMemo(
    () =>
      shipmentRoutes.flatMap((route) => {
        const evaluation = routeRiskResults[route.id];
        const resolvedRiskLevel = evaluation?.riskLevel || route.riskLevel || 'low';
        const primaryRoute = {
          ...route,
          riskLevel: resolvedRiskLevel,
        };

        if (resolvedRiskLevel !== 'high') {
          return [primaryRoute];
        }

        return [
          primaryRoute,
          {
            id: `${route.id}-alternate`,
            shipmentId: route.shipmentId,
            coordinates: evaluation?.alternateCoordinates || buildAlternateRoute(route.coordinates),
            riskLevel: 'low',
            isAlternate: true,
            label: `${route.label} (Alternate Route)`,
          },
        ];
      }),
    [shipmentRoutes, routeRiskResults]
  );

  const handleEvaluateRouteRisks = async () => {
    if (!shipmentRoutes.length) {
      return;
    }

    try {
      setIsEvaluatingRisk(true);
      setErrorMessage('');

      const evaluationEntries = await Promise.all(
        shipmentRoutes.map(async (route) => {
          const [lat, lng] = route.coordinates[0] || [];

          if (lat === undefined || lng === undefined) {
            return [route.id, { riskLevel: route.riskLevel || 'low' }];
          }

          const response = await apiClient.post('/routes/evaluate-risk', { lat, lng });
          const riskLevel = response.data?.data?.riskLevel || 'low';

          return [
            route.id,
            {
              riskLevel,
              alternateCoordinates: riskLevel === 'high' ? buildAlternateRoute(route.coordinates) : null,
            },
          ];
        })
      );

      setRouteRiskResults(Object.fromEntries(evaluationEntries));
    } catch (error) {
      setErrorMessage(error.response?.data?.message || 'Failed to evaluate route risks.');
    } finally {
      setIsEvaluatingRisk(false);
    }
  };

  const handleReportLandslide = async () => {
    const payload = buildLandslideIncidentPayload();

    if (!navigator.onLine) {
      const queuedIncidents = readQueuedIncidents();
      writeQueuedIncidents([...queuedIncidents, payload]);
      toast('You are offline. Data is cached locally.', {
        icon: '📡',
      });
      return;
    }

    try {
      setIsSubmittingIncident(true);
      await apiClient.post('/incidents', payload);
      toast.success('Landslide report submitted successfully.');
    } catch (error) {
      const queuedIncidents = readQueuedIncidents();
      writeQueuedIncidents([...queuedIncidents, payload]);
      toast.error(error.response?.data?.message || 'Failed to submit landslide report. Saved for retry.');
    } finally {
      setIsSubmittingIncident(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-3 text-slate-600">
          Monitor active relief vehicles across the North Eastern Region of India.
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Active Vehicle Map</h2>
            <p className="text-sm text-slate-600">
              Live map view of active shipments and their current route paths.
            </p>
          </div>

          <div className="text-sm text-slate-500">
            Active shipments: <span className="font-semibold text-slate-700">{activeShipments.length}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleEvaluateRouteRisks}
            disabled={isLoading || isEvaluatingRisk || shipmentRoutes.length === 0}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isEvaluatingRisk ? 'Evaluating...' : 'Evaluate Route Risks'}
          </button>

          <button
            type="button"
            onClick={handleReportLandslide}
            disabled={isSubmittingIncident}
            className="inline-flex items-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmittingIncident ? 'Reporting...' : 'Report Landslide'}
          </button>
        </div>

        {errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
            Loading active shipments...
          </div>
        ) : (
          <MapViewer activeVehicles={activeVehicles} routes={activeRoutes} />
        )}
      </section>
    </div>
  );
}

export default Dashboard;