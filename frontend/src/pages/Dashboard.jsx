import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import apiClient from '../api/apiClient';
import { getApiErrorMessage } from '../api/apiError';
import Loader from '../components/Loader';
import MapViewer from '../components/MapViewer';
import ReportIncidentModal from '../components/ReportIncidentModal';

const SHIPMENTS_CACHE_KEY = 'dm-shipments-cache';
const INCIDENT_QUEUE_KEY = 'dm-offline-incident-queue';

// ── Chart colours matching risk scheme ───────────────────────────────────────
const STATUS_COLORS = {
  'in-transit': '#2563eb',
  pending: '#eab308',
  assigned: '#8b5cf6',
  delivered: '#16a34a',
  delayed: '#dc2626',
};

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

  if (vehicleLocation) return vehicleLocation;

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

      if (!vehicleCoordinates) return null;

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
        ? routeCoordinates.map((coordinate) => getCoordinatesFromValue(coordinate)).filter(Boolean)
        : [];

      const originCoordinates = getCoordinatesFromValue(shipment.originCoordinates) || getCoordinatesFromValue(shipment.origin);
      const destinationCoordinates =
        getCoordinatesFromValue(shipment.destinationCoordinates) || getCoordinatesFromValue(shipment.destination);

      const coordinates =
        normalizedRouteCoordinates.length >= 2
          ? normalizedRouteCoordinates
          : [originCoordinates, destinationCoordinates].filter(Boolean);

      if (coordinates.length < 2) return null;

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
  if (!Array.isArray(coordinates) || coordinates.length < 2) return [];

  const midpointIndex = Math.floor((coordinates.length - 1) / 2);
  const midpoint = coordinates[midpointIndex];

  if (!midpoint) return coordinates;

  const alternateMidpoint = [
    Number((midpoint[0] + 0.18).toFixed(4)),
    Number((midpoint[1] + 0.22).toFixed(4)),
  ];

  return [coordinates[0], alternateMidpoint, coordinates[coordinates.length - 1]];
};

const readCachedShipments = () => {
  try {
    const cachedValue = localStorage.getItem(SHIPMENTS_CACHE_KEY);
    if (!cachedValue) return [];
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
    if (!cachedValue) return [];
    const parsedValue = JSON.parse(cachedValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
};

const writeQueuedIncidents = (incidents) => {
  localStorage.setItem(INCIDENT_QUEUE_KEY, JSON.stringify(incidents));
};

const buildIncidentPayload = ({ type, description, latitude, longitude }) => ({
  type,
  title: `${type.charAt(0).toUpperCase()}${type.slice(1)} reported from dashboard`,
  description,
  severity: type === 'roadblock' ? 'medium' : 'high',
  location: {
    lat: latitude,
    lng: longitude,
    address: 'Reported from live operations dashboard',
  },
  status: 'reported',
});

// ── AI Assistant Chat Panel ───────────────────────────────────────────────────
function AiAssistantPanel({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Hello! I can answer questions about recent incidents, route risks, and logistics. Try: "Analyze recent road blockages" or "How many high-severity incidents?"' },
  ]);
  const [isQuerying, setIsQuerying] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAsk = async (e) => {
    e.preventDefault();
    const question = query.trim();
    if (!question) return;

    setMessages((m) => [...m, { role: 'user', text: question }]);
    setQuery('');
    setIsQuerying(true);

    try {
      const response = await apiClient.post('/ai/rag-query', { question });
      const answer = response.data?.data?.answer || 'No answer returned from AI service.';
      const source = response.data?.data?.source || '';
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: answer,
          meta: source.includes('fallback') ? '⚡ Local RAG fallback' : '🤖 FastAPI RAG',
        },
      ]);
    } catch (error) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', text: `Error: ${getApiErrorMessage(error, 'RAG query failed. Please check the AI service.')}`, isError: true },
      ]);
    } finally {
      setIsQuerying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-[900] flex w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-white">🤖 AI Operations Assistant</h2>
          <p className="text-xs text-blue-100">RAG-powered — asks about real incident data</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-blue-100 transition hover:bg-white/20"
          aria-label="Close AI assistant"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((message, i) => (
          <div
            key={i}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.isError
                  ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              <p>{message.text}</p>
              {message.meta && (
                <p className="mt-1 text-xs text-slate-400">{message.meta}</p>
              )}
            </div>
          </div>
        ))}

        {isQuerying && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-500">
              <span className="animate-pulse">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleAsk} className="border-t border-slate-200 px-3 py-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about incidents, risks, routes…"
            disabled={isQuerying}
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isQuerying || !query.trim()}
            className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            Ask
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Analytics Charts Section ──────────────────────────────────────────────────
function AnalyticsSection({ shipments }) {
  const chartData = useMemo(() => {
    const counts = {};
    for (const s of shipments) {
      counts[s.status] = (counts[s.status] || 0) + 1;
    }
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  }, [shipments]);

  if (!chartData.length) return null;

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Shipment Analytics</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Bar chart */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Status Breakdown</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="status" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v) => [v, 'Shipments']}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="flex flex-col items-center">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Distribution</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={60}
                innerRadius={30}
                paddingAngle={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v, name) => [v, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
            {chartData.map((entry) => (
              <span key={entry.status} className="flex items-center gap-1 text-xs text-slate-600">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[entry.status] || '#94a3b8' }}
                />
                {entry.status}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard() {
  const [shipments, setShipments] = useState(() => readCachedShipments());
  const [isLoading, setIsLoading] = useState(() => readCachedShipments().length === 0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isEvaluatingRisk, setIsEvaluatingRisk] = useState(false);
  const [routeRiskResults, setRouteRiskResults] = useState({});
  const [isSubmittingIncident, setIsSubmittingIncident] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);

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
      setErrorMessage('Unable to load live shipment data. Showing last cached snapshot if available.');
      toast.error(getApiErrorMessage(error, 'Failed to fetch shipments. Please check network.'));
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
      } catch (error) {
        failedIncidents.push(incident);
        toast.error(getApiErrorMessage(error, 'Failed to sync offline incident report. Please check network.'));
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
      toast('You are offline. Data is cached locally.', { icon: '📡' });
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
        const primaryRoute = { ...route, riskLevel: resolvedRiskLevel };

        if (resolvedRiskLevel !== 'high') return [primaryRoute];

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
    if (!shipmentRoutes.length) return;

    try {
      setIsEvaluatingRisk(true);
      setErrorMessage('');

      const evaluationEntries = await Promise.all(
        shipmentRoutes.map(async (route) => {
          const [lat, lng] = route.coordinates[0] || [];

          if (lat === undefined || lng === undefined) {
            return [route.id, { riskLevel: route.riskLevel || 'low' }];
          }

          try {
            const response = await apiClient.post('/ai/predict-risk', { lat, lng });
            const riskLevel = response.data?.data?.risk_level || response.data?.data?.riskLevel || 'low';

            return [
              route.id,
              {
                riskLevel,
                alternateCoordinates: riskLevel === 'high' ? buildAlternateRoute(route.coordinates) : null,
              },
            ];
          } catch (error) {
            // Fallback: try the original route risk endpoint
            try {
              const fallback = await apiClient.post('/routes/evaluate-risk', { lat, lng });
              const riskLevel = fallback.data?.data?.riskLevel || 'low';
              return [route.id, { riskLevel, alternateCoordinates: riskLevel === 'high' ? buildAlternateRoute(route.coordinates) : null }];
            } catch {
              toast.error(getApiErrorMessage(error, 'Failed to evaluate route risk.'));
              return [route.id, { riskLevel: route.riskLevel || 'low', alternateCoordinates: null }];
            }
          }
        })
      );

      setRouteRiskResults(Object.fromEntries(evaluationEntries));
    } catch (error) {
      setErrorMessage('Failed to evaluate route risks.');
      toast.error(getApiErrorMessage(error, 'Failed to fetch routes. Please check network.'));
    } finally {
      setIsEvaluatingRisk(false);
    }
  };

  const handleReportIncident = async ({ type, description, latitude, longitude }) => {
    const payload = buildIncidentPayload({ type, description, latitude, longitude });

    if (!navigator.onLine) {
      const queuedIncidents = readQueuedIncidents();
      writeQueuedIncidents([...queuedIncidents, payload]);
      toast('You are offline. Incident saved for later sync.', { icon: '📡' });
      setIsIncidentModalOpen(false);
      return;
    }

    try {
      setIsSubmittingIncident(true);
      await apiClient.post('/incidents', payload);
      toast.success('Incident reported. Agentic loop triggered — monitoring for rerouting...');
      setIsIncidentModalOpen(false);
    } catch (error) {
      const queuedIncidents = readQueuedIncidents();
      writeQueuedIncidents([...queuedIncidents, payload]);
      toast.error(getApiErrorMessage(error, 'Failed to submit incident report. Saved for retry.'));
    } finally {
      setIsSubmittingIncident(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col gap-6">
      {/* Header */}
      <section className="rounded-xl bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="mt-3 text-slate-600">
              Monitor active relief vehicles across the North Eastern Region of India.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAiPanelOpen((o) => !o)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
            title="Open AI Operations Assistant"
          >
            🤖 <span className="hidden sm:inline">AI Assistant</span>
          </button>
        </div>
      </section>

      {/* Analytics */}
      <AnalyticsSection shipments={shipments} />

      {/* Map Section */}
      <section className="flex flex-1 flex-col space-y-3">
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
            {isEvaluatingRisk ? 'Evaluating...' : '🧠 Evaluate Route Risks (DL)'}
          </button>

          <button
            type="button"
            onClick={fetchShipments}
            disabled={isLoading}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            {isLoading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>

        {/* Map Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-green-500" /> Low Risk</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-yellow-400" /> Moderate Risk</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-red-600" /> High Risk</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-px w-5 border-b-2 border-dashed border-blue-500" />
            Alternate Route
          </span>
        </div>

        {errorMessage ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="relative flex flex-1 flex-col">
          {isLoading && activeVehicles.length === 0 ? (
            <div className="flex min-h-[360px] flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-10 shadow-sm sm:min-h-[420px] lg:min-h-[calc(100vh-24rem)]">
              <Loader label="Loading active shipments..." size="lg" />
            </div>
          ) : (
            <MapViewer activeVehicles={activeVehicles} routes={activeRoutes} isLoading={isLoading} />
          )}

          <button
            type="button"
            onClick={() => setIsIncidentModalOpen(true)}
            className="absolute bottom-5 right-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-lg transition hover:bg-amber-600 focus:outline-none focus:ring-4 focus:ring-amber-200"
            aria-label="Open incident reporting modal"
          >
            <span className="text-3xl leading-none">+</span>
          </button>
        </div>
      </section>

      <ReportIncidentModal
        isOpen={isIncidentModalOpen}
        isSubmitting={isSubmittingIncident}
        onClose={() => setIsIncidentModalOpen(false)}
        onSubmit={handleReportIncident}
      />

      <AiAssistantPanel isOpen={isAiPanelOpen} onClose={() => setIsAiPanelOpen(false)} />
    </div>
  );
}

export default Dashboard;