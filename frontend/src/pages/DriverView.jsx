import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5055';

const defaultRoute = {
  name: 'Guwahati to Shillong Relief Corridor',
  vehicleNumber: 'AS01-SIH-1001',
  destination: 'Shillong, Meghalaya',
  coordinates: [
    [26.1445, 91.7362],
    [25.5788, 91.8933],
  ],
};

const formatCoordinate = (coordinate) => {
  if (Array.isArray(coordinate)) {
    return `${Number(coordinate[0]).toFixed(4)}, ${Number(coordinate[1]).toFixed(4)}`;
  }

  if (coordinate && typeof coordinate === 'object') {
    const latitude = coordinate.latitude ?? coordinate.lat;
    const longitude = coordinate.longitude ?? coordinate.lng ?? coordinate.lon;

    if (latitude !== undefined && longitude !== undefined) {
      return `${Number(latitude).toFixed(4)}, ${Number(longitude).toFixed(4)}`;
    }
  }

  return String(coordinate);
};

const normalizeAlternateRoute = (alert = {}) => {
  const coordinates =
    alert.alternateRouteCoordinates ||
    alert.alternateCoordinates ||
    alert.route?.alternateCoordinates ||
    alert.route?.coordinates ||
    [];

  return Array.isArray(coordinates) ? coordinates : [];
};

function DriverView() {
  const [status, setStatus] = useState('safe');
  const [currentRoute, setCurrentRoute] = useState(defaultRoute);
  const [alternateRouteCoordinates, setAlternateRouteCoordinates] = useState([]);
  const [lastAlertMessage, setLastAlertMessage] = useState('');

  useEffect(() => {
    const socket = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect_error', () => {
      toast.error('Live driver updates are unavailable. Please check backend connectivity.');
    });

    socket.on('route_hazard_alert', (alert) => {
      setStatus('hazard');
      setAlternateRouteCoordinates(normalizeAlternateRoute(alert));
      setLastAlertMessage(alert?.message || 'Hazard detected ahead. Follow the alternate route.');

      if (alert?.currentRoute || alert?.route) {
        setCurrentRoute((route) => ({
          ...route,
          ...(alert.currentRoute || alert.route),
        }));
      }
    });

    return () => {
      socket.off('connect_error');
      socket.off('route_hazard_alert');
      socket.disconnect();
    };
  }, []);

  const isHazard = status === 'hazard';

  return (
    <div className="mx-auto min-h-[calc(100vh-9rem)] max-w-[400px] overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-950 shadow-2xl">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 px-5 py-6 text-white">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-blue-200">Driver Mode</p>
            <h1 className="mt-1 text-2xl font-bold">SmartLogistics NER</h1>
          </div>
          <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-blue-100">
            LIVE
          </div>
        </div>

        <div
          className={`rounded-2xl px-4 py-5 text-center shadow-lg transition-colors duration-300 ${
            isHazard ? 'bg-red-600 text-white' : 'bg-green-500 text-white'
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.25em] opacity-90">Current Status</p>
          <p className="mt-2 text-2xl font-black">
            {isHazard ? 'HAZARD AHEAD: REROUTING' : 'SAFE'}
          </p>
        </div>
      </div>

      <div className="space-y-5 bg-slate-100 px-5 py-6">
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Assigned Route</p>
          <h2 className="mt-2 text-xl font-bold text-slate-900">{currentRoute.name}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Vehicle</p>
              <p className="font-semibold text-slate-900">{currentRoute.vehicleNumber}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Destination</p>
              <p className="font-semibold text-slate-900">{currentRoute.destination}</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Current Route Coordinates</p>
          <div className="mt-3 space-y-2">
            {currentRoute.coordinates.map((coordinate, index) => (
              <div key={`${formatCoordinate(coordinate)}-${index}`} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                Stop {index + 1}: <span className="font-semibold">{formatCoordinate(coordinate)}</span>
              </div>
            ))}
          </div>
        </section>

        {isHazard ? (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">Alternate Route</p>
            <p className="mt-2 text-sm text-red-700">{lastAlertMessage}</p>

            <div className="mt-4 space-y-2">
              {alternateRouteCoordinates.length ? (
                alternateRouteCoordinates.map((coordinate, index) => (
                  <div key={`${formatCoordinate(coordinate)}-${index}`} className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-800">
                    Point {index + 1}: <span className="font-semibold">{formatCoordinate(coordinate)}</span>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-600">
                  Waiting for alternate route coordinates...
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border border-green-200 bg-green-50 p-5 text-sm text-green-700 shadow-sm">
            No hazards reported on your assigned route. Continue following dispatch instructions.
          </section>
        )}
      </div>
    </div>
  );
}

export default DriverView;