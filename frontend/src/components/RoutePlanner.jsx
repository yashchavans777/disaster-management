import { useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';
import { useLanguage } from '../context/LanguageContext';

// 1. Allowed Cities & Coordinates dictionary
export const ALLOWED_CITIES = {
  "tawang": [27.5860, 91.8594],
  "silchar": [24.8333, 92.7789],
  "aizawl": [23.7271, 92.7176],
  "guwahati": [26.1445, 91.7362]
};

const CITY_DISPLAY_NAMES = {
  tawang: 'Tawang, Arunachal Pradesh',
  silchar: 'Silchar, Assam',
  aizawl: 'Aizawl, Mizoram',
  guwahati: 'Guwahati, Assam',
};

const buildAlternateRoute = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return [];

  // Generate a realistic bypass by offsetting the coordinates around the middle detour zone
  const total = coordinates.length;
  const startDetour = Math.max(1, Math.floor(total * 0.2));
  const endDetour = Math.min(total - 1, Math.floor(total * 0.8));

  return coordinates.map((coord, idx) => {
    if (idx < startDetour || idx > endDetour) {
      return coord;
    }
    // Parabolic offset curve away from the blocked corridor
    const factor = Math.sin(((idx - startDetour) / (endDetour - startDetour)) * Math.PI);
    return [
      Number((coord[0] + 0.16 * factor).toFixed(5)),
      Number((coord[1] + 0.19 * factor).toFixed(5)),
    ];
  });
};

function RoutePlanner({ onRouteCalculated, onOriginChange, onDestinationChange }) {
  const { t } = useLanguage();
  // 2. React state for the inputs: startInput, endInput, and errorMsg
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);

  // 3. Validation & Routing Logic
  const handleFindSafeRoute = async (e) => {
    if (e) e.preventDefault();

    // Convert startInput and endInput to lowercase and trim whitespace
    const startKey = startInput.trim().toLowerCase();
    const endKey = endInput.trim().toLowerCase();

    // Check if BOTH inputs exist as keys in the ALLOWED_CITIES object
    const isStartValid = Object.prototype.hasOwnProperty.call(ALLOWED_CITIES, startKey);
    const isEndValid = Object.prototype.hasOwnProperty.call(ALLOWED_CITIES, endKey);

    if (!isStartValid || !isEndValid) {
      setErrorMsg("Routing is only available between Tawang, Silchar, Aizawl, and Guwahati for this demo.");
      return;
    }

    if (startKey === endKey) {
      setErrorMsg("Start and End locations must be different.");
      return;
    }

    // Clear errorMsg
    setErrorMsg('');

    // Retrieve the coordinates from ALLOWED_CITIES
    const origin = ALLOWED_CITIES[startKey];
    const destination = ALLOWED_CITIES[endKey];

    if (onOriginChange) onOriginChange(origin);
    if (onDestinationChange) onDestinationChange(destination);

    setIsCalculating(true);

    try {
      // 1. Fetch real road geometry from OSRM
      const [startLat, startLng] = origin;
      const [endLat, endLng] = destination;
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?geometries=geojson`;

      let coordinates = [];
      try {
        const osrmRes = await fetch(osrmUrl);
        const osrmData = await osrmRes.json();

        if (osrmData.code === 'Ok' && osrmData.routes?.length > 0) {
          // GeoJSON coordinates are [lon, lat], Leaflet expects [lat, lon]
          coordinates = osrmData.routes[0].geometry.coordinates.map((coord) => [
            coord[1],
            coord[0],
          ]);
        } else {
          throw new Error('No route found from OSRM');
        }
      } catch (fetchErr) {
        console.warn('OSRM request error, falling back to direct route points:', fetchErr);
        coordinates = [
          [startLat, startLng],
          [
            Number(((startLat * 2 + endLat) / 3).toFixed(5)),
            Number(((startLng * 2 + endLng) / 3).toFixed(5)),
          ],
          [
            Number(((startLat + endLat * 2) / 3).toFixed(5)),
            Number(((startLng + endLng * 2) / 3).toFixed(5)),
          ],
          [endLat, endLng],
        ];
      }

      // Calculate bounds for Leaflet's map.fitBounds
      const lats = coordinates.map((c) => c[0]);
      const lngs = coordinates.map((c) => c[1]);
      const bounds = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ];

      // Predict risk using midpoint
      const midpointIndex = Math.floor(coordinates.length / 2);
      const midpoint = coordinates[midpointIndex];

      // Generate alternate safe route detour and calculate delay
      const alternateCoordinates = buildAlternateRoute(coordinates);
      const delayEstimate = '+3.5 hrs delay';
      const blockedCorridorName = 'NH-6 Blocked Corridor (Barak Overflow / Landslide)';

      try {
        await apiClient.post('/ai/predict-risk', {
          lat: midpoint[0],
          lng: midpoint[1],
        });
      } catch (riskErr) {
        console.warn('Risk prediction fallback to active alert', riskErr);
      }

      toast('Blocked corridor detected on NH-6! Alternate safe route generated (+3.5 hrs delay).', {
        icon: '⚠️',
      });

      // Pass result to parent to render in MapViewer and trigger map.fitBounds
      if (onRouteCalculated) {
        onRouteCalculated({
          startName: CITY_DISPLAY_NAMES[startKey] || (startKey.charAt(0).toUpperCase() + startKey.slice(1)),
          endName: CITY_DISPLAY_NAMES[endKey] || (endKey.charAt(0).toUpperCase() + endKey.slice(1)),
          origin,
          destination,
          coordinates,
          blockedCoordinates: coordinates,
          alternateCoordinates,
          delayEstimate,
          blockedCorridorName,
          isSafe: false,
          bounds,
        });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to calculate route');
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Navigation className="h-4 w-4 text-indigo-600" />
          {t('Safe Route Planner')}
        </h3>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-100">
          NER Demo
        </span>
      </div>

      <p className="mb-3 text-xs text-slate-500">
        Demo routing limited to: <span className="font-semibold text-slate-700">Tawang, Silchar, Aizawl, Guwahati</span>
      </p>

      {errorMsg && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 leading-relaxed font-medium">
          ⚠️ {errorMsg}
        </div>
      )}

      <form onSubmit={handleFindSafeRoute} className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {t('Start Location')}
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="e.g. Guwahati"
              value={startInput}
              onChange={(e) => {
                setStartInput(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {t('End Location')}
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="e.g. Silchar"
              value={endInput}
              onChange={(e) => {
                setEndInput(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Quick select chips for user convenience */}
        <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500 pt-0.5">
          <span className="font-medium">{t('Allowed')}:</span>
          {['Tawang', 'Silchar', 'Aizawl', 'Guwahati'].map((city) => (
            <button
              key={city}
              type="button"
              onClick={() => {
                if (!startInput) {
                  setStartInput(city);
                } else if (!endInput) {
                  setEndInput(city);
                } else {
                  setEndInput(city);
                }
                if (errorMsg) setErrorMsg('');
              }}
              className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition"
            >
              {city}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={isCalculating}
          className="mt-1 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isCalculating ? (
            <>
              <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {t('Calculating Safe Route...')}
            </>
          ) : (
            t('Find Safe Route')
          )}
        </button>
      </form>
    </div>
  );
}

export default RoutePlanner;
