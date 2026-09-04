import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
} from 'react-leaflet';

import Loader from './Loader';

const NORTH_EAST_INDIA_CENTER = [26.2006, 92.9376];
const riskColors = {
  low: '#16a34a',
  moderate: '#eab308',
  high: '#dc2626',
};

const SOCKET_SERVER_URL =
  import.meta.env.VITE_SOCKET_URL || 'http://localhost:5055';
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

import { useMap } from 'react-leaflet';

const NER_BOUNDS = [
  [21.0, 89.0], // SouthWest
  [29.5, 97.5], // NorthEast
];
const SILCHAR_CENTER = [24.82, 92.8];

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

function MapViewer({
  activeVehicles = [],
  routes = [],
  isLoading = false,
  plannerRoute = null,
}) {
  const [liveVehicles, setLiveVehicles] = useState(activeVehicles);
  const animationsRef = useRef(new Map());
  const liveVehiclesRef = useRef(activeVehicles);

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
    const socket = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
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
      socket.off('vehicle_moved');
      socket.disconnect();
      animationsRef.current.forEach((cancelAnimation) => cancelAnimation());
      animationsRef.current.clear();
    };
  }, []);

  const visibleVehicles = useMemo(
    () =>
      liveVehicles.filter(
        (vehicle) =>
          vehicle.latitude !== undefined && vehicle.longitude !== undefined
      ),
    [liveVehicles]
  );

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
        maxZoom={18}
        maxBounds={NER_BOUNDS}
        zoomAnimation={true}
        fadeAnimation={true}
        scrollWheelZoom
        className="h-full min-h-[360px] w-full sm:min-h-[420px]"
      >
        <MapController boundsToFit={plannerRoute?.bounds} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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

        {plannerRoute && (
          <>
            {/* Primary Route */}
            <Polyline
              positions={plannerRoute.coordinates}
              pathOptions={{
                color: plannerRoute.isSafe ? '#10b981' : '#ef4444', // Green if safe, Red if risky
                weight: 5,
                opacity: 0.9,
              }}
            />
            {/* Alternate Route if Risky */}
            {!plannerRoute.isSafe && plannerRoute.alternateCoordinates && (
              <Polyline
                positions={plannerRoute.alternateCoordinates}
                pathOptions={{
                  color: '#f59e0b', // Orange for alternate
                  weight: 4,
                  opacity: 0.8,
                  dashArray: '10 8',
                }}
              />
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

        {visibleVehicles.map((vehicle) => (
          <Marker
            key={vehicle.id}
            position={[vehicle.latitude, vehicle.longitude]}
          >
            <Popup>
              <div className="min-w-[180px]">
                <h3 className="font-semibold text-slate-900">{vehicle.name}</h3>
                <p className="text-sm text-slate-600">
                  Status: {vehicle.status}
                </p>
                <p className="text-sm text-slate-600">
                  Driver: {vehicle.driverName}
                </p>
                {vehicle.lastUpdatedAt ? (
                  <p className="text-xs text-slate-500">
                    Updated:{' '}
                    {new Date(vehicle.lastUpdatedAt).toLocaleTimeString()}
                  </p>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default MapViewer;
