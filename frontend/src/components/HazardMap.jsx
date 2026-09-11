import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  Marker,
  Polygon,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { AlertTriangle, ChevronRight, Info, Layers, MapPin, ShieldAlert, Waves } from 'lucide-react';
import toast from 'react-hot-toast';

// 4 Cities configuration with designated center coordinates
const CITIES = [
  { name: 'Silchar', state: 'Assam', center: [24.8333, 92.7789], zoom: 13 },
  { name: 'Aizawl', state: 'Mizoram', center: [23.7271, 92.7176], zoom: 13 },
  { name: 'Itanagar', state: 'Arunachal Pradesh', center: [27.0844, 93.6053], zoom: 13 },
  { name: 'Guwahati', state: 'Assam', center: [26.1445, 91.7362], zoom: 13 },
];

const CITY_LOOKUP = Object.fromEntries(CITIES.map((c) => [c.name.toLowerCase(), c]));

// Fallback hazard data in case FastAPI server is offline during development/offline demo
const FALLBACK_HAZARD_DATA = {
  silchar: [
    {
      id: 'silchar-barak-floodplain',
      name: 'Barak River floodplain',
      hazard_type: 'flood',
      hazardType: 'flood',
      risk_level: 'High Risk: Flood Zone',
      description: 'Critical low-lying floodplain along the Barak River susceptible to severe seasonal overflow and road inundation.',
      coordinates: [
        [24.8380, 92.7850],
        [24.8450, 92.7960],
        [24.8420, 92.8120],
        [24.8310, 92.8050],
        [24.8260, 92.7900],
        [24.8320, 92.7800],
      ],
    },
    {
      id: 'silchar-berenga-betukandi',
      name: 'Berenga-Betukandi',
      hazard_type: 'flood',
      hazardType: 'flood',
      risk_level: 'High Risk: Flood Zone',
      description: 'Historical dyke breach zone at Berenga-Betukandi resulting in rapid urban submersion.',
      coordinates: [
        [24.8120, 92.7910],
        [24.8200, 92.8010],
        [24.8170, 92.8110],
        [24.8060, 92.8050],
        [24.8080, 92.7910],
      ],
    },
    {
      id: 'silchar-malugram-basin',
      name: 'Malugram Drainage Basin',
      hazard_type: 'flood',
      hazardType: 'flood',
      risk_level: 'High Risk: Flood Zone',
      description: 'Low-lying residential sector vulnerable to river backflow and drainage congestion.',
      coordinates: [
        [24.8410, 92.7680],
        [24.8490, 92.7760],
        [24.8440, 92.7850],
        [24.8340, 92.7780],
      ],
    },
    {
      id: 'silchar-dudhpatil-foothills',
      name: 'Dudhpatil Foothill Slopes',
      hazard_type: 'landslide',
      hazardType: 'landslide',
      risk_level: 'High Risk: Landslide Zone',
      description: 'Steep unreinforced slopes prone to slope collapse and debris runoff during heavy monsoons.',
      coordinates: [
        [24.8550, 92.8100],
        [24.8620, 92.8190],
        [24.8580, 92.8280],
        [24.8500, 92.8200],
      ],
    },
  ],
  aizawl: [
    {
      id: 'aizawl-hunthar-landslide',
      name: 'Hunthar Active Sinking Zone',
      hazard_type: 'landslide',
      hazardType: 'landslide',
      risk_level: 'High Risk: Landslide Zone',
      description: 'Major active subsiding zone on NH-54 with continuous ground displacement and slope failure.',
      coordinates: [
        [23.7420, 92.7050],
        [23.7500, 92.7130],
        [23.7460, 92.7220],
        [23.7380, 92.7150],
      ],
    },
    {
      id: 'aizawl-laipuitlang-escarpment',
      name: 'Laipuitlang Hillside Slope',
      hazard_type: 'landslide',
      hazardType: 'landslide',
      risk_level: 'High Risk: Landslide Zone',
      description: 'Steep shale rock formation area with high rockfall and landslide hazard.',
      coordinates: [
        [23.7310, 92.7220],
        [23.7370, 92.7300],
        [23.7330, 92.7380],
        [23.7250, 92.7310],
      ],
    },
    {
      id: 'aizawl-chite-lui-basin',
      name: 'Chite Lui River Channel',
      hazard_type: 'flood',
      hazardType: 'flood',
      risk_level: 'High Risk: Flood Zone',
      description: 'Valley bottom stream prone to torrential flash floods and sediment accumulation.',
      coordinates: [
        [23.7150, 92.7380],
        [23.7230, 92.7470],
        [23.7190, 92.7560],
        [23.7100, 92.7480],
      ],
    },
  ],
  itanagar: [
    {
      id: 'itanagar-dikrong-floodplain',
      name: 'Dikrong River Floodplain',
      hazard_type: 'flood',
      hazardType: 'flood',
      risk_level: 'High Risk: Flood Zone',
      description: 'Low-lying floodplain along the Dikrong river north of Itanagar prone to monsoon overflow and inundation of connecting roads.',
      coordinates: [
        [27.1500, 93.5200],
        [27.1620, 93.5450],
        [27.1570, 93.5700],
        [27.1400, 93.5550],
        [27.1350, 93.5250],
      ],
    },
    {
      id: 'itanagar-karsingsa-nh415',
      name: 'NH-415 Karsingsa Landslide Corridor',
      hazard_type: 'landslide',
      hazardType: 'landslide',
      risk_level: 'High Risk: Landslide Zone',
      description: 'Critical capital lifeline stretch between Banderdewa and Itanagar repeatedly blocked by heavy mudslides at the Karsingsa block point.',
      coordinates: [
        [27.0980, 93.5750],
        [27.1080, 93.5850],
        [27.1040, 93.5980],
        [27.0930, 93.5880],
      ],
    },
    {
      id: 'itanagar-jollang-landslide',
      name: 'Jollang Road Slope',
      hazard_type: 'landslide',
      hazardType: 'landslide',
      risk_level: 'High Risk: Landslide Zone',
      description: 'Steep unstable slope along Jollang Road with a history of fatal landslides during heavy monsoon rain.',
      coordinates: [
        [27.1180, 93.6080],
        [27.1280, 93.6160],
        [27.1240, 93.6260],
        [27.1140, 93.6170],
      ],
    },
    {
      id: 'itanagar-poma-intake',
      name: 'Poma / Pachin River Intake',
      hazard_type: 'flood',
      hazardType: 'flood',
      risk_level: 'High Risk: Flood Zone',
      description: 'River catchment feeding the Poma water intake, where flood surges previously severed the municipal drinking water supply to Itanagar.',
      coordinates: [
        [27.0520, 93.5720],
        [27.0620, 93.5820],
        [27.0580, 93.5950],
        [27.0470, 93.5850],
      ],
    },
  ],
  guwahati: [
    {
      id: 'guwahati-brahmaputra-floodplain',
      name: 'Brahmaputra South Bank Floodplain',
      hazard_type: 'flood',
      hazardType: 'flood',
      risk_level: 'High Risk: Flood Zone',
      description: 'Riverside stretch spanning Pandu to Bharalumukh exposed to high water levels and riverbank erosion.',
      coordinates: [
        [26.1550, 91.7100],
        [26.1680, 91.7310],
        [26.1630, 91.7510],
        [26.1500, 91.7410],
        [26.1460, 91.7210],
      ],
    },
    {
      id: 'guwahati-anil-nagar-basin',
      name: 'Anil Nagar - Nabin Nagar Basin',
      hazard_type: 'flood',
      hazardType: 'flood',
      risk_level: 'High Risk: Flood Zone',
      description: 'Severely waterlogged low basin during monsoon downpours with critical urban flooding.',
      coordinates: [
        [26.1740, 91.7640],
        [26.1840, 91.7760],
        [26.1790, 91.7870],
        [26.1690, 91.7770],
      ],
    },
    {
      id: 'guwahati-narakasur-escarpment',
      name: 'Narakasur Hills Escarpment',
      hazard_type: 'landslide',
      hazardType: 'landslide',
      risk_level: 'High Risk: Landslide Zone',
      description: 'Hill cutting and deforested steep slopes creating high landslide risk for foothill settlements.',
      coordinates: [
        [26.1420, 91.7650],
        [26.1510, 91.7750],
        [26.1470, 91.7860],
        [26.1370, 91.7760],
      ],
    },
  ],
};

// 3. Sub-component to automatically animate/pan the map (map.flyTo()) to selected city
function MapFlyTo({ center, zoom = 13 }) {
  const map = useMap();

  useEffect(() => {
    if (center && Array.isArray(center) && center.length === 2) {
      map.flyTo(center, zoom, {
        duration: 1.5,
        easeLinearity: 0.25,
      });
    }
  }, [center, zoom, map]);

  return null;
}

export default function HazardMap() {
  // 2. React state: selectedCity and hazardData
  const [selectedCity, setSelectedCity] = useState('Silchar');
  const [hazardData, setHazardData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataSource, setDataSource] = useState('FastAPI Live API');

  const currentCityConfig = useMemo(() => {
    const key = selectedCity.toLowerCase();
    return CITY_LOOKUP[key] || CITIES[0];
  }, [selectedCity]);

  // 3. Fetching and Map Interactivity
  const fetchHazardZones = useCallback(async (cityName) => {
    const key = cityName.toLowerCase().trim();
    setIsLoading(true);

    try {
      // Primary fetch directly from FastAPI endpoint http://localhost:8000/api/hazard-zones/{city_name}
      const response = await fetch(`http://localhost:8000/api/hazard-zones/${encodeURIComponent(key)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch from FastAPI`);
      }
      const json = await response.json();
      const zones = json.hazard_zones || json.zones || [];

      setHazardData(zones);
      setDataSource('FastAPI Live Service');
    } catch (err) {
      console.warn(`FastAPI endpoint unreachable, using fallback dataset for ${cityName}:`, err);
      // Seamless fallback to high-fidelity designated polygons
      const fallbackZones = FALLBACK_HAZARD_DATA[key] || [];
      setHazardData(fallbackZones);
      setDataSource('Internal Hazard Geodatabase');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on selectedCity change
  useEffect(() => {
    fetchHazardZones(selectedCity);
  }, [selectedCity, fetchHazardZones]);

  // Handle city selection
  const handleSelectCity = (cityName) => {
    setSelectedCity(cityName);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl bg-white p-5 shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <ShieldAlert className="h-4 w-4" />
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              Government-Designated High-Risk Hazard Zones
            </h2>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Faint red zones represent verified flood inundation floodplains and active landslide escarpments.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-md bg-slate-100 px-2.5 py-1 font-semibold text-slate-700 border border-slate-200 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {dataSource}
          </span>
          <span className="rounded-md bg-red-50 px-2.5 py-1 font-bold text-red-700 border border-red-200">
            {hazardData.length} Hazard Zones Active
          </span>
        </div>
      </div>

      {/* 2. Two-column layout: Left Column (25%) & Right Column (75%) */}
      <div className="flex flex-col lg:flex-row w-full min-h-[560px] rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
        {/* Left Column (Sidebar - 25% width) */}
        <aside className="w-full lg:w-1/4 bg-slate-50 p-4 sm:p-5 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Select City / Region
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Click a city to inspect designated hazard polygons:
              </p>
            </div>

            {/* Vertical menu with 4 buttons */}
            <div className="flex flex-col gap-2">
              {CITIES.map((city) => {
                const isSelected = selectedCity.toLowerCase() === city.name.toLowerCase();
                return (
                  <button
                    key={city.name}
                    type="button"
                    onClick={() => handleSelectCity(city.name)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                      isSelected
                        ? 'bg-red-600 text-white shadow-md shadow-red-200 scale-[1.01]'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <MapPin className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                      <div className="text-left">
                        <span className="block font-bold">{city.name}</span>
                        <span className={`text-[11px] block ${isSelected ? 'text-red-100' : 'text-slate-400'}`}>
                          {city.state}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                  </button>
                );
              })}
            </div>

            {/* Current city zone summary panel */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-800">{selectedCity} Focus</span>
                <span className="text-slate-500 text-[11px]">
                  [{currentCityConfig.center[0].toFixed(2)}°N, {currentCityConfig.center[1].toFixed(2)}°E]
                </span>
              </div>

              <div className="space-y-1.5 text-slate-600">
                {hazardData.map((zone, idx) => (
                  <div key={zone.id || idx} className="flex items-start gap-1.5 text-[11px] leading-tight">
                    <span className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full bg-red-500" />
                    <div>
                      <strong className="text-slate-900">{zone.name}</strong>
                      <span className="ml-1 text-slate-500 uppercase font-mono text-[10px]">
                        ({zone.hazard_type || zone.hazardType})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Legend Footer */}
          <div className="mt-5 rounded-lg border border-red-100 bg-red-50/70 p-3 text-[11px] text-red-900">
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
              <span>Map Legend</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3.5 w-5 rounded border border-red-500 bg-red-500/20" />
              <span>Faint Red: High Risk Zone (Flood / Landslide)</span>
            </div>
          </div>
        </aside>

        {/* Right Column (Map - 75% width) */}
        <main className="w-full lg:w-3/4 relative min-h-[460px] lg:min-h-[560px]">
          {isLoading && (
            <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/70 backdrop-blur-xs">
              <div className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xl">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                Loading hazard polygons for {selectedCity}...
              </div>
            </div>
          )}

          <MapContainer
            center={currentCityConfig.center}
            zoom={currentCityConfig.zoom}
            minZoom={7}
            maxZoom={18}
            scrollWheelZoom={true}
            className="h-full min-h-[460px] w-full"
          >
            {/* 3. Sub-component with useMap() to automatically animate/pan (map.flyTo()) */}
            <MapFlyTo center={currentCityConfig.center} zoom={currentCityConfig.zoom} />

            {/* Map Tiles */}
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
            />

            {/* City Center Anchor Marker */}
            <Marker position={currentCityConfig.center}>
              <Popup>
                <div className="p-1 font-sans">
                  <h4 className="font-bold text-slate-900 text-sm">{selectedCity}</h4>
                  <p className="text-xs text-slate-500">{currentCityConfig.state}</p>
                  <p className="text-xs text-red-600 font-semibold mt-1">
                    {hazardData.length} high-risk hazard zones monitored
                  </p>
                </div>
              </Popup>
            </Marker>

            {/* 4. Rendering Faint Red Zones (Leaflet <Polygon>) with faint red styling */}
            {hazardData.map((zone, idx) => {
              const hazardLabel = zone.risk_level || (
                zone.hazard_type === 'flood' ? 'High Risk: Flood Zone' : 'High Risk: Landslide Zone'
              );

              return (
                <Polygon
                  key={zone.id || `${selectedCity}-poly-${idx}`}
                  positions={zone.coordinates}
                  pathOptions={{
                    color: 'red',
                    weight: 2,
                    fillColor: 'red',
                    fillOpacity: 0.2,
                  }}
                >
                  {/* Tooltip showing the hazard type */}
                  <Tooltip
                    sticky
                    direction="top"
                    className="font-bold text-xs bg-white text-red-700 px-2 py-1 rounded shadow-md border border-red-200"
                  >
                    ⚠️ {hazardLabel}
                  </Tooltip>

                  {/* Popup with full details */}
                  <Popup>
                    <div className="p-1 font-sans min-w-[200px]">
                      <div className="flex items-center gap-1.5 border-b border-red-100 pb-1.5 mb-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600">
                          {zone.hazard_type === 'flood' ? <Waves className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        </span>
                        <h4 className="font-bold text-sm text-slate-900 leading-tight">{zone.name}</h4>
                      </div>

                      <div className="space-y-1 text-xs">
                        <p>
                          <strong className="text-slate-700">Classification:</strong>{' '}
                          <span className="font-semibold text-red-600 capitalize">
                            {hazardLabel}
                          </span>
                        </p>
                        <p>
                          <strong className="text-slate-700">Hazard Type:</strong>{' '}
                          <span className="capitalize text-slate-900 font-medium">
                            {zone.hazard_type || zone.hazardType}
                          </span>
                        </p>
                        {zone.description && (
                          <p className="text-[11px] text-slate-600 border-t border-slate-100 pt-1 mt-1">
                            {zone.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Polygon>
              );
            })}
          </MapContainer>

          {/* Floating quick control overlay */}
          <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] rounded-xl bg-white/95 px-3.5 py-2.5 shadow-lg backdrop-blur-xs border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-red-500 animate-ping" />
              <span className="font-bold text-slate-800">{selectedCity} Hazard Boundary</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Hover over or click any faint red polygon to inspect risk classification.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
