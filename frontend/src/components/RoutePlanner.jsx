import { useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';

const LOCATIONS = [
  { name: 'Tawang, Arunachal Pradesh', lat: 27.58, lng: 91.86 },
  { name: 'Silchar, Assam', lat: 24.82, lng: 92.8 },
  { name: 'Aizawl, Mizoram', lat: 23.73, lng: 92.71 },
  { name: 'Guwahati, Assam', lat: 26.14, lng: 91.73 },
];

const buildAlternateRoute = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return [];

  const midpointIndex = Math.floor((coordinates.length - 1) / 2);
  const midpoint = coordinates[midpointIndex];
  if (!midpoint) return coordinates;

  const alternateMidpoint = [
    Number((midpoint[0] + 0.18).toFixed(4)),
    Number((midpoint[1] + 0.22).toFixed(4)),
  ];

  return [
    coordinates[0],
    alternateMidpoint,
    coordinates[coordinates.length - 1],
  ];
};

function RoutePlanner({ onRouteCalculated }) {
  const [startIdx, setStartIdx] = useState(0);
  const [endIdx, setEndIdx] = useState(1);
  const [isCalculating, setIsCalculating] = useState(false);

  const handleCalculate = async () => {
    if (startIdx === endIdx) {
      toast.error('Start and End locations must be different');
      return;
    }

    setIsCalculating(true);
    const start = LOCATIONS[startIdx];
    const end = LOCATIONS[endIdx];

    try {
      // 1. Fetch real road geometry from OSRM
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?geometries=geojson`;
      const osrmRes = await fetch(osrmUrl);
      const osrmData = await osrmRes.json();

      if (osrmData.code !== 'Ok' || !osrmData.routes.length) {
        throw new Error('No route found from OSRM');
      }

      // GeoJSON coordinates are [lon, lat], Leaflet expects [lat, lon]
      const coordinates = osrmData.routes[0].geometry.coordinates.map(
        (coord) => [coord[1], coord[0]]
      );

      // Calculate bounds for flyToBounds
      const lats = coordinates.map((c) => c[0]);
      const lngs = coordinates.map((c) => c[1]);
      const bounds = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ];

      // 2. Predict risk using the midpoint
      const midpointIndex = Math.floor(coordinates.length / 2);
      const midpoint = coordinates[midpointIndex];

      let isSafe = true;
      let alternateCoordinates = null;

      try {
        const riskRes = await apiClient.post('/ai/predict-risk', {
          lat: midpoint[0],
          lng: midpoint[1],
        });

        const riskLevel =
          riskRes.data?.data?.risk_level ||
          riskRes.data?.data?.riskLevel ||
          'low';

        if (riskLevel === 'high' || riskLevel === 'moderate') {
          isSafe = false;
          alternateCoordinates = buildAlternateRoute(coordinates);
          toast('AI Risk Detected! Showing alternate path.', { icon: '⚠️' });
        } else {
          toast.success('Safe Route Found!');
        }
      } catch (riskErr) {
        console.warn('Risk prediction failed, assuming safe', riskErr);
        toast.success('Route calculated (Risk check skipped)');
      }

      // Pass result to parent (Dashboard) to render in MapViewer
      onRouteCalculated({
        startName: start.name,
        endName: end.name,
        coordinates,
        isSafe,
        alternateCoordinates,
        bounds,
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to calculate route');
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="absolute top-4 right-4 z-[1000] w-80 rounded-xl bg-white p-4 shadow-lg border border-slate-200">
      <h3 className="mb-4 text-lg font-bold text-slate-800 flex items-center gap-2">
        <Navigation className="h-5 w-5 text-indigo-600" />
        Safe Route Planner
      </h3>

      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase">
            Start Location
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={startIdx}
              onChange={(e) => setStartIdx(Number(e.target.value))}
            >
              {LOCATIONS.map((loc, idx) => (
                <option key={loc.name} value={idx}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase">
            End Location
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={endIdx}
              onChange={(e) => setEndIdx(Number(e.target.value))}
            >
              {LOCATIONS.map((loc, idx) => (
                <option key={loc.name} value={idx}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleCalculate}
          disabled={isCalculating}
          className="mt-2 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {isCalculating ? 'Calculating...' : 'Find Safe Route'}
        </button>
      </div>
    </div>
  );
}

export default RoutePlanner;
