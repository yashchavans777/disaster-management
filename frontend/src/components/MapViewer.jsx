import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import apiClient from '../api/apiClient';
import { fetchRoute } from '../utils/routing';

import LiveNavigator from './LiveNavigator';
import Loader from './Loader';

// Custom Vehicle DivIcon for high visibility without 404 image issues
const vehicleMarkerIcon = L.divIcon({
  className: 'custom-vehicle-marker',
  html: `
    <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); width: 34px; height: 34px; border-radius: 50%; border: 2.5px solid #ffffff; box-shadow: 0 4px 10px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; cursor: pointer;">
      🚚
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -18],
});

const warehouseMarkerIcon = L.divIcon({
  className: 'warehouse-transport-marker',
  html: `
    <div style="background: linear-gradient(135deg, #047857, #10b981); width: 38px; height: 38px; border-radius: 12px; border: 2.5px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; cursor: pointer;">
      🚚
    </div>
  `,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -20],
});

const activeDeliveryMarkerIcon = L.divIcon({
  className: 'active-delivery-marker',
  html: `
    <div style="position: relative; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 42px; height: 42px; border-radius: 999px; background: rgba(37, 99, 235, 0.22); animation: pulse 1.6s infinite;"></div>
      <div style="position: relative; background: linear-gradient(135deg, #1d4ed8, #60a5fa); width: 32px; height: 32px; border-radius: 999px; border: 2.5px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-size: 15px; cursor: pointer;">
        🚛
      </div>
    </div>
  `,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  popupAnchor: [0, -20],
});

const destinationMarkerIcon = L.divIcon({
  className: 'clicked-destination-marker',
  html: `
    <div style="background: linear-gradient(135deg, #dc2626, #f97316); width: 36px; height: 36px; border-radius: 999px 999px 999px 8px; transform: rotate(-45deg); border: 2.5px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; cursor: pointer;">
      <span style="transform: rotate(45deg); color: white; font-size: 16px;">🏠</span>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 34],
  popupAnchor: [0, -34],
});

const NORTH_EAST_INDIA_CENTER = [26.2006, 92.9376];
const riskColors = {
  low: '#16a34a',
  moderate: '#eab308',
  high: '#dc2626',
};

const SOCKET_SERVER_URL =
  import.meta.env.VITE_SOCKET_URL || 'http://localhost:5055';
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const MAPBOX_STREETS_TILE_URL = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`;
const FALLBACK_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const ANIMATION_DURATION_MS = 900;

const getVehicleKeys = (vehicle = {}) =>
  [
    vehicle.id,
    vehicle._id,
    vehicle.vehicleId,
    vehicle.trackingId,
    vehicle.vehicleNumber,
    vehicle.registrationNumber,
  ]
    .filter(Boolean)
    .map(String);

const getUpdateKeys = (update = {}) =>
  [
    update.id,
    update._id,
    update.shipmentId,
    update.vehicleId,
    update.trackingId,
    update.vehicleNumber,
    update.registrationNumber,
  ]
    .filter(Boolean)
    .map(String);

const getUpdateCoordinates = (update = {}) => {
  const latitude =
    update.latitude ??
    update.lat ??
    update.location?.latitude ??
    update.location?.lat;
  const longitude =
    update.longitude ??
    update.lng ??
    update.lon ??
    update.location?.longitude ??
    update.location?.lng;

  if (latitude === undefined || longitude === undefined) {
    return null;
  }

  return {
    latitude: Number(latitude),
    longitude: Number(longitude),
  };
};

const animateVehicleMovement = (vehicle, update, onFrame) => {
  const coordinates = getUpdateCoordinates(update);

  if (
    !coordinates ||
    Number.isNaN(coordinates.latitude) ||
    Number.isNaN(coordinates.longitude)
  ) {
    return undefined;
  }

  const startLatitude = Number(vehicle.latitude);
  const startLongitude = Number(vehicle.longitude);
  const deltaLatitude = coordinates.latitude - startLatitude;
  const deltaLongitude = coordinates.longitude - startLongitude;
  const startedAt = performance.now();
  let animationFrameId;

  const step = (timestamp) => {
    const progress = Math.min(
      (timestamp - startedAt) / ANIMATION_DURATION_MS,
      1
    );
    const easedProgress = 1 - (1 - progress) ** 3;

    onFrame({
      ...vehicle,
      latitude: Number(
        (startLatitude + deltaLatitude * easedProgress).toFixed(6)
      ),
      longitude: Number(
        (startLongitude + deltaLongitude * easedProgress).toFixed(6)
      ),
      status: update.status || vehicle.status,
      driverName:
        update.driverName || update.driver?.name || vehicle.driverName,
      lastUpdatedAt: update.updatedAt || new Date().toISOString(),
    });

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(step);
    }
  };

  animationFrameId = requestAnimationFrame(step);

  return () => cancelAnimationFrame(animationFrameId);
};

const NER_BOUNDS = [
  [21.0, 89.0], // SouthWest
  [29.5, 97.5], // NorthEast
];
const SILCHAR_CENTER = [24.82, 92.8];
const SILCHAR_RELIEF_WAREHOUSE = [24.8333, 92.7789];
const BERENGA_BETUKANDI_FLOOD_ZONE = [24.815, 92.795];

// Sub-component to handle map flyToBounds
function MapController({ boundsToFit }) {
  const map = useMap();
  useEffect(() => {
    if (boundsToFit && boundsToFit.length > 0) {
      map.flyToBounds(boundsToFit, { padding: [50, 50], duration: 1.5 });
    }
  }, [boundsToFit, map]);
  return null;
}

function MapClickHandler({ onDestinationSelect }) {
  useMapEvents({
    click(event) {
      const { lat, lng } = event.latlng;
      onDestinationSelect([lat, lng]);
    },
  });

  return null;
}

function MapViewer({
  activeVehicles = [],
  routes = [],
  isLoading = false,
  plannerRoute = null,
}) {
  const [liveVehicles, setLiveVehicles] = useState(activeVehicles);
  const [destination, setDestination] = useState(BERENGA_BETUKANDI_FLOOD_ZONE);
  const [routeCoords, setRouteCoords] = useState([]);
  const animationsRef = useRef(new Map());
  const liveVehiclesRef = useRef(activeVehicles);

  useEffect(() => {
    let isMounted = true;

    const loadRoute = async () => {
      try {
        const coordinates = await fetchRoute(
          SILCHAR_RELIEF_WAREHOUSE,
          destination
        );

        if (isMounted) {
          setRouteCoords(coordinates);
        }
      } catch (error) {
        console.warn('MapViewer: OSRM route fetch error:', error);
        if (isMounted) {
          setRouteCoords([]);
        }
      }
    };

    loadRoute();

    return () => {
      isMounted = false;
    };
  }, [destination]);

  useEffect(() => {
    setLiveVehicles((currentVehicles) => {
      const currentById = new Map(
        currentVehicles.map((vehicle) => [vehicle.id, vehicle])
      );

      return activeVehicles.map(
        (vehicle) => currentById.get(vehicle.id) || vehicle
      );
    });
  }, [activeVehicles]);

  useEffect(() => {
    liveVehiclesRef.current = liveVehicles;
  }, [liveVehicles]);

  useEffect(() => {
    // Initialize socket with polling fallback and capped reconnection
    const socket = io(SOCKET_SERVER_URL, {
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
      timeout: 4000,
    });

    // Gracefully handle offline server without throwing fatal red console errors
    socket.on('connect_error', (error) => {
      // Degrade gracefully when backend on port 5055 is offline
    });

    socket.on('connect', () => {
      // Connected to live vehicle telemetry feed
    });

    socket.on('vehicle_moved', (locationUpdate) => {
      const updateKeys = getUpdateKeys(locationUpdate);
      const matchedVehicle = liveVehiclesRef.current.find((vehicle) =>
        getVehicleKeys(vehicle).some((vehicleKey) =>
          updateKeys.includes(vehicleKey)
        )
      );

      if (!matchedVehicle) {
        return;
      }

      const cancelExistingAnimation = animationsRef.current.get(
        matchedVehicle.id
      );

      if (cancelExistingAnimation) {
        cancelExistingAnimation();
      }

      const cancelAnimation = animateVehicleMovement(
        matchedVehicle,
        locationUpdate,
        (nextVehicle) => {
          setLiveVehicles((vehiclesDuringAnimation) =>
            vehiclesDuringAnimation.map((vehicle) =>
              vehicle.id === matchedVehicle.id ? nextVehicle : vehicle
            )
          );
        }
      );

      if (cancelAnimation) {
        animationsRef.current.set(matchedVehicle.id, cancelAnimation);
      }
    });

    return () => {
      socket.off('connect_error');
      socket.off('connect');
      socket.off('vehicle_moved');
      socket.disconnect();
      animationsRef.current.forEach((cancelAnimation) => cancelAnimation());
      animationsRef.current.clear();
    };
  }, []);

  // Task 1: Fetch shipments directly from /api/shipments
  const [fetchedShipments, setFetchedShipments] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const loadShipments = async () => {
      try {
        const res = await apiClient.get('/shipments');
        const data = res.data?.data || res.data || [];
        if (Array.isArray(data) && isMounted) {
          setFetchedShipments(data);
        }
      } catch (err) {
        console.warn('MapViewer: /api/shipments fetch error:', err);
      }
    };

    loadShipments();
    const interval = setInterval(loadShipments, 12000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Map fetched shipments to vehicle marker data
  const shipmentMarkers = useMemo(() => {
    return fetchedShipments
      .map((shipment) => {
        const vehicle = shipment.assignedVehicle || shipment.vehicle;
        const driver = shipment.assignedDriver || shipment.driver;

        let lat =
          vehicle?.currentLocation?.lat ??
          shipment.currentLocation?.lat ??
          shipment.location?.lat;
        let lng =
          vehicle?.currentLocation?.lng ??
          shipment.currentLocation?.lng ??
          shipment.location?.lng;

        // Fallbacks for NER coordinates if not explicitly pinned
        if (lat == null || lng == null) {
          const orig = (shipment.origin || '').toLowerCase();
          if (orig.includes('silchar')) {
            lat = 25.045;
            lng = 92.932;
          } else if (orig.includes('guwahati')) {
            lat = 25.5788;
            lng = 91.8933;
          } else if (orig.includes('badarpur')) {
            lat = 24.892;
            lng = 92.684;
          }
        }

        if (lat == null || lng == null) return null;

        const vehicleId =
          vehicle?.vehicleNumber ||
          vehicle?.registrationNumber ||
          vehicle?._id ||
          shipment.trackingId ||
          'AS11-EC-2024';

        const cargoType =
          shipment.cargoType || shipment.title || 'Medical Kits';
        const liveStatus = shipment.status || 'in-transit';

        return {
          id: shipment._id || shipment.trackingId,
          vehicleId,
          cargoType,
          liveStatus,
          name: vehicleId,
          driverName: driver?.name || 'Field Driver',
          origin: shipment.origin,
          destination: shipment.destination,
          latitude: Number(lat),
          longitude: Number(lng),
          lastUpdatedAt: shipment.updatedAt,
        };
      })
      .filter(Boolean);
  }, [fetchedShipments]);

  const visibleVehicles = useMemo(
    () =>
      liveVehicles.filter(
        (vehicle) =>
          vehicle.latitude !== undefined && vehicle.longitude !== undefined
      ),
    [liveVehicles]
  );

  // Combine visible vehicles from props and direct /api/shipments
  const allVehicleMarkers = useMemo(() => {
    const combined = [...shipmentMarkers];
    for (const v of visibleVehicles) {
      const vId = v.vehicleNumber || v.name || v.id;
      if (!combined.some((m) => m.id === v.id || m.vehicleId === vId)) {
        combined.push({
          id: v.id,
          vehicleId: vId,
          cargoType: v.cargoType || 'Medical Kits',
          liveStatus: v.status || 'in-transit',
          name: vId,
          driverName: v.driverName || 'Field Driver',
          latitude: v.latitude,
          longitude: v.longitude,
          lastUpdatedAt: v.lastUpdatedAt,
        });
      }
    }
    return combined;
  }, [shipmentMarkers, visibleVehicles]);

  return (
    <div className="relative flex min-h-[360px] flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:min-h-[420px] lg:min-h-[calc(100vh-18rem)]">
      {isLoading ? (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/85 backdrop-blur-sm">
          <Loader label="Loading routes and shipments..." size="lg" />
        </div>
      ) : null}

      <MapContainer
        center={SILCHAR_CENTER}
        zoom={7}
        minZoom={6}
        maxZoom={20}
        maxBounds={NER_BOUNDS}
        zoomAnimation={true}
        fadeAnimation={true}
        scrollWheelZoom
        className="h-full min-h-[360px] w-full sm:min-h-[420px]"
      >
        <MapController boundsToFit={plannerRoute?.bounds} />
        <MapClickHandler onDestinationSelect={setDestination} />
        <LiveNavigator destination={destination} />

        <TileLayer
          attribution={
            MAPBOX_TOKEN
              ? '© Mapbox © OpenStreetMap'
              : 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
          }
          maxZoom={20}
          tileSize={256}
          url={MAPBOX_TOKEN ? MAPBOX_STREETS_TILE_URL : FALLBACK_TILE_URL}
        />

        {routes.map((route) => (
          <Polyline
            key={route.id}
            positions={route.coordinates}
            pathOptions={{
              color: route.isAlternate
                ? '#2563eb'
                : riskColors[route.riskLevel] || route.color || '#2563eb',
              weight: route.isAlternate ? 3 : 4,
              opacity: 0.85,
              dashArray: route.isAlternate ? '10 8' : undefined,
            }}
          />
        ))}

        {routeCoords.length > 0 && (
          <Polyline
            positions={routeCoords}
            pathOptions={{ color: 'blue', opacity: 0.7, weight: 5 }}
          >
            <Popup>
              <div className="p-1 text-xs">
                <span className="block font-bold text-blue-700">
                  Live OSRM Navigation Route
                </span>
                <span>
                  Silchar Relief Warehouse → selected relief destination
                </span>
              </div>
            </Popup>
          </Polyline>
        )}

        <Marker position={SILCHAR_RELIEF_WAREHOUSE} icon={warehouseMarkerIcon}>
          <Popup>
            <div className="p-1 text-xs">
              <span className="block font-bold text-emerald-700">
                🚚 Silchar Relief Warehouse
              </span>
              <span>Dispatch origin for emergency supplies.</span>
            </div>
          </Popup>
        </Marker>

        <Marker position={destination} icon={destinationMarkerIcon}>
          <Popup>
            <div className="p-1 text-xs">
              <span className="block font-bold text-orange-700">
                🏠 Selected Relief Destination
              </span>
              <span className="block text-slate-600">
                Click any home or area on the map to reroute supplies here.
              </span>
              <span className="mt-1 block font-mono text-[11px] text-slate-500">
                {destination[0].toFixed(5)}, {destination[1].toFixed(5)}
              </span>
            </div>
          </Popup>
        </Marker>

        {routeCoords.length > 0 && (
          <Marker
            position={routeCoords[Math.floor(routeCoords.length * 0.35)]}
            icon={activeDeliveryMarkerIcon}
          >
            <Popup>
              <div className="p-1 text-xs">
                <span className="block font-bold text-blue-700">
                  🚛 Active Delivery Vehicle
                </span>
                <span>Medical and relief supplies en route to flood zone.</span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Task 4: Alternate Route Polylines (Red = Blocked Corridor, Green = Alternate Safe Route) */}
        {plannerRoute && (
          <>
            {/* Blocked Corridor - Color Red */}
            <Polyline
              positions={
                plannerRoute.blockedCoordinates || plannerRoute.coordinates
              }
              pathOptions={{
                color: 'red',
                weight: 5,
                opacity: 0.85,
              }}
            >
              <Popup>
                <div className="p-1 text-xs">
                  <span className="font-bold text-red-600 block">
                    ⚠️ Blocked Corridor
                  </span>
                  <span>
                    {plannerRoute.blockedCorridorName ||
                      'NH-6 Disrupted Stretch (Landslide / Barak Overflow)'}
                  </span>
                </div>
              </Popup>
            </Polyline>

            {/* Alternate Safe Route - Color Green with delay estimate Tooltip */}
            {plannerRoute.alternateCoordinates && (
              <Polyline
                positions={plannerRoute.alternateCoordinates}
                pathOptions={{
                  color: 'green',
                  weight: 5,
                  opacity: 0.9,
                  dashArray: '8 6',
                }}
              >
                <Tooltip
                  permanent
                  direction="top"
                  className="font-bold text-xs bg-emerald-700 text-white rounded px-2 py-0.5 shadow-md"
                >
                  {plannerRoute.delayEstimate || '+3.5 hrs delay'}
                </Tooltip>
                <Popup>
                  <div className="p-1 text-xs">
                    <span className="font-bold text-green-700 block">
                      ✅ Alternate Safe Route
                    </span>
                    <span className="text-slate-600">
                      Estimated Delay:{' '}
                      {plannerRoute.delayEstimate || '+3.5 hrs delay'}
                    </span>
                  </div>
                </Popup>
              </Polyline>
            )}

            {/* Start and End Markers */}
            <Marker position={plannerRoute.coordinates[0]}>
              <Popup>Start: {plannerRoute.startName}</Popup>
            </Marker>
            <Marker
              position={
                plannerRoute.coordinates[plannerRoute.coordinates.length - 1]
              }
            >
              <Popup>End: {plannerRoute.endName}</Popup>
            </Marker>
          </>
        )}

        {/* Task 1: Live Vehicle Markers on Map with Popup displaying Vehicle ID, Cargo Type, and Live Status */}
        {allVehicleMarkers.map((vehicle) => (
          <Marker
            key={vehicle.id}
            position={[vehicle.latitude, vehicle.longitude]}
            icon={vehicleMarkerIcon}
          >
            <Popup>
              <div className="min-w-[190px] p-1 font-sans">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-bold text-sm text-slate-900">
                      {vehicle.vehicleId}
                    </span>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700 border border-blue-200">
                    {vehicle.liveStatus}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600">
                  <p>
                    <strong className="text-slate-700">Vehicle ID:</strong>{' '}
                    <span className="font-mono text-slate-900 font-semibold">
                      {vehicle.vehicleId}
                    </span>
                  </p>
                  <p>
                    <strong className="text-slate-700">Cargo Type:</strong>{' '}
                    <span className="text-slate-900 font-medium">
                      {vehicle.cargoType}
                    </span>
                  </p>
                  <p>
                    <strong className="text-slate-700">Live Status:</strong>{' '}
                    <span className="font-semibold text-emerald-600">
                      {vehicle.liveStatus}
                    </span>
                  </p>
                  {vehicle.driverName && (
                    <p className="text-slate-500 text-[11px]">
                      Driver: {vehicle.driverName}
                    </p>
                  )}
                  {vehicle.origin && vehicle.destination && (
                    <p className="text-[11px] text-slate-500 border-t border-slate-100 pt-1">
                      Route: {vehicle.origin} → {vehicle.destination}
                    </p>
                  )}
                  {vehicle.lastUpdatedAt && (
                    <p className="text-[10px] text-slate-400">
                      Last Update:{' '}
                      {new Date(vehicle.lastUpdatedAt).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default MapViewer;
