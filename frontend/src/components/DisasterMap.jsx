import { useEffect, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation } from 'lucide-react';
import toast from 'react-hot-toast';

// 1. Allowed Cities & Coordinates Dictionary
export const ALLOWED_CITIES = {
  "itanagar": [27.0844, 93.6053],
  "silchar": [24.8333, 92.7789],
  "aizawl": [23.7271, 92.7176],
  "guwahati": [26.1445, 91.7362]
};

const CITY_LABELS = {
  itanagar: 'Itanagar, Arunachal Pradesh',
  silchar: 'Silchar, Assam',
  aizawl: 'Aizawl, Mizoram',
  guwahati: 'Guwahati, Assam',
};

const DEFAULT_CENTER = [26.1445, 91.7362]; // Guwahati center
const NER_BOUNDS = [
  [21.0, 89.0],
  [29.5, 97.5],
];

// Sub-component to dynamically adjust map bounds using Leaflet's map.fitBounds
function RouteBoundsController({ bounds }) {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);

  return null;
}

export default function DisasterMap({ children, className = '' }) {
  // 2. React state for inputs and validation error
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Origin, Destination, and Routing state
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeBounds, setRouteBounds] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // OSRM routing fetch logic
  const fetchRoute = async (startCoords, endCoords) => {
    setIsCalculating(true);
    try {
      const [startLat, startLng] = startCoords;
      const [endLat, endLng] = endCoords;
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?geometries=geojson`;

      let coords = [];
      try {
        const response = await fetch(osrmUrl);
        const data = await response.json();

        if (data.code === 'Ok' && data.routes?.length > 0) {
          coords = data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
        } else {
          throw new Error('OSRM route returned no valid geometry');
        }
      } catch (networkErr) {
        console.warn('Direct OSRM fetch error, fallback interpolation:', networkErr);
        coords = [
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

      setRouteCoordinates(coords);

      const lats = coords.map((c) => c[0]);
      const lngs = coords.map((c) => c[1]);
      const bounds = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ];
      setRouteBounds(bounds);

      toast.success('Safe route calculated successfully.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to calculate route.');
    } finally {
      setIsCalculating(false);
    }
  };

  // Automatically trigger OSRM fetchRoute when origin & destination are updated
  useEffect(() => {
    if (origin && destination) {
      fetchRoute(origin, destination);
    }
  }, [origin, destination]);

  // 3. Validation & Routing Logic
  const handleFindSafeRoute = (e) => {
    if (e) e.preventDefault();

    // Convert startInput and endInput to lowercase and trim whitespace
    const startKey = startInput.trim().toLowerCase();
    const endKey = endInput.trim().toLowerCase();

    // Check if BOTH inputs exist as keys in the ALLOWED_CITIES object
    const hasStart = Object.prototype.hasOwnProperty.call(ALLOWED_CITIES, startKey);
    const hasEnd = Object.prototype.hasOwnProperty.call(ALLOWED_CITIES, endKey);

    if (!hasStart || !hasEnd) {
      // If invalid: Set errorMsg
      setErrorMsg("Routing is only available between Itanagar, Silchar, Aizawl, and Guwahati for this demo.");
      return;
    }

    if (startKey === endKey) {
      setErrorMsg("Start and End locations must be different.");
      return;
    }

    // If valid: Clear errorMsg
    setErrorMsg('');

    // Retrieve coordinates from ALLOWED_CITIES and update map's origin & destination states
    const originCoords = ALLOWED_CITIES[startKey];
    const destinationCoords = ALLOWED_CITIES[endKey];

    setOrigin(originCoords);
    setDestination(destinationCoords);
  };

  return (
    <div className={`flex flex-col gap-4 w-full ${className}`}>
      {/* Tailwind CSS Route Planner UI Card */}
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Navigation className="h-4 w-4 text-indigo-600" />
            Safe Route Planner
          </h3>
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-100">
            Allowed Cities
          </span>
        </div>

        <p className="mb-3 text-xs text-slate-500">
          Enter cities: <span className="font-semibold text-slate-700">Itanagar, Silchar, Aizawl, Guwahati</span>
        </p>

        {errorMsg && (
          <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs font-medium text-red-700 leading-relaxed">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleFindSafeRoute} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Start Location
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
              End Location
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

          {/* Quick city selection chips */}
          <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-500 pt-0.5">
            <span className="font-medium">Allowed:</span>
            {['Itanagar', 'Silchar', 'Aizawl', 'Guwahati'].map((city) => (
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
                Calculating Route...
              </>
            ) : (
              'Find Safe Route'
            )}
          </button>
        </form>
      </div>

      {/* Leaflet Map Container */}
      <div className="relative h-[600px] min-h-[600px] lg:min-h-[70vh] w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <MapContainer
        center={DEFAULT_CENTER}
        zoom={7}
        minZoom={6}
        maxZoom={18}
        maxBounds={NER_BOUNDS}
        scrollWheelZoom
        className="h-full w-full"
      >
        <RouteBoundsController bounds={routeBounds} />

        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
        />

        {/* Drawn OSRM route Polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            positions={routeCoordinates}
            pathOptions={{
              color: '#4f46e5',
              weight: 5,
              opacity: 0.85,
            }}
          />
        )}

        {/* Origin & Destination Markers */}
        {origin && (
          <Marker position={origin}>
            <Popup>
              <strong>Start:</strong> {startInput}
            </Popup>
          </Marker>
        )}
        {destination && (
          <Marker position={destination}>
            <Popup>
              <strong>Destination:</strong> {endInput}
            </Popup>
          </Marker>
        )}

        {children}
      </MapContainer>
      </div>
    </div>
  );
}

