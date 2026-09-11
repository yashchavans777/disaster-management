import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

import { fetchRoute } from '../utils/routing';

const ROUTE_REFRESH_INTERVAL_MS = 10000;
const ROUTE_REFRESH_DISTANCE_KM = 0.05;

const bikeMarkerIcon = L.divIcon({
  className: 'live-bike-navigation-marker',
  html: `
    <div style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 48px; height: 48px; border-radius: 999px; background: rgba(34, 197, 94, 0.24); animation: pulse 1.4s infinite;"></div>
      <div style="position: relative; background: linear-gradient(135deg, #16a34a, #22c55e); width: 36px; height: 36px; border-radius: 999px; border: 3px solid #ffffff; box-shadow: 0 6px 16px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; cursor: pointer;">
        🛵
      </div>
    </div>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
  popupAnchor: [0, -24],
});

function calculateDistanceKm(startCoords, endCoords) {
  if (!startCoords || !endCoords) {
    return null;
  }

  const [startLat, startLng] = startCoords;
  const [endLat, endLng] = endCoords;
  const earthRadiusKm = 6371;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;

  const dLat = toRadians(endLat - startLat);
  const dLng = toRadians(endLng - startLng);
  const lat1 = toRadians(startLat);
  const lat2 = toRadians(endLat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function formatDistance(distanceKm) {
  if (distanceKm == null) {
    return 'Calculating...';
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }

  return `${distanceKm.toFixed(2)} km`;
}

function getGeolocationErrorMessage(error) {
  if (!error) {
    return 'Unable to access GPS location.';
  }

  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission denied. Please allow GPS access to start navigation.';
    case error.POSITION_UNAVAILABLE:
      return 'GPS signal unavailable. Move to an open area and try again.';
    case error.TIMEOUT:
      return 'GPS request timed out. Please check location services and retry.';
    default:
      return error.message || 'Unable to access GPS location.';
  }
}

function NavigationAutoCenter({ currentLocation, isNavigating }) {
  const map = useMap();

  useEffect(() => {
    if (isNavigating && currentLocation) {
      map.setView(currentLocation, 18, { animate: true });
    }
  }, [currentLocation, isNavigating, map]);

  return null;
}

function LiveNavigator({ destination }) {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationRoute, setNavigationRoute] = useState([]);
  const [distanceRemaining, setDistanceRemaining] = useState(null);
  const [speed, setSpeed] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [isRouteRefreshing, setIsRouteRefreshing] = useState(false);

  const watchIdRef = useRef(null);
  const lastRouteFetchAtRef = useRef(0);
  const lastRouteOriginRef = useRef(null);
  const previousDestinationRef = useRef(destination);

  const canUseGeolocation =
    typeof navigator !== 'undefined' && 'geolocation' in navigator;

  const stopNavigation = useCallback(() => {
    if (watchIdRef.current !== null && canUseGeolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setIsNavigating(false);
    setCurrentLocation(null);
    setNavigationRoute([]);
    setDistanceRemaining(null);
    setSpeed(null);
    setIsRouteRefreshing(false);
    lastRouteFetchAtRef.current = 0;
    lastRouteOriginRef.current = null;
  }, [canUseGeolocation]);

  const refreshNavigationRoute = useCallback(
    async (origin, force = false) => {
      if (!origin || !destination) {
        return;
      }

      const now = Date.now();
      const lastOrigin = lastRouteOriginRef.current;
      const movedSinceLastFetchKm = lastOrigin
        ? calculateDistanceKm(lastOrigin, origin)
        : Number.POSITIVE_INFINITY;
      const shouldRefresh =
        force ||
        now - lastRouteFetchAtRef.current >= ROUTE_REFRESH_INTERVAL_MS ||
        movedSinceLastFetchKm >= ROUTE_REFRESH_DISTANCE_KM;

      if (!shouldRefresh) {
        return;
      }

      try {
        setIsRouteRefreshing(true);
        const route = await fetchRoute(origin, destination);
        setNavigationRoute(route);
        lastRouteFetchAtRef.current = now;
        lastRouteOriginRef.current = origin;
      } catch (error) {
        console.warn(
          'LiveNavigator: OSRM navigation route fetch error:',
          error
        );
        setLocationError(
          'Live GPS is active, but route refresh failed. Retrying on next update.'
        );
      } finally {
        setIsRouteRefreshing(false);
      }
    },
    [destination]
  );

  const startNavigation = useCallback(() => {
    setLocationError('');

    if (!destination) {
      setLocationError(
        'Select a destination on the map before starting navigation.'
      );
      return;
    }

    if (!canUseGeolocation) {
      setLocationError('Geolocation is not supported in this browser/device.');
      return;
    }

    if (watchIdRef.current !== null) {
      return;
    }

    setIsNavigating(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const liveLocation = [
          position.coords.latitude,
          position.coords.longitude,
        ];

        setCurrentLocation(liveLocation);
        setSpeed(
          typeof position.coords.speed === 'number'
            ? position.coords.speed
            : null
        );
        setDistanceRemaining(calculateDistanceKm(liveLocation, destination));
        setLocationError('');
        refreshNavigationRoute(liveLocation);
      },
      (error) => {
        setLocationError(getGeolocationErrorMessage(error));
        if (error?.code === error.PERMISSION_DENIED) {
          stopNavigation();
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 15000,
      }
    );
  }, [canUseGeolocation, destination, refreshNavigationRoute, stopNavigation]);

  useEffect(() => {
    if (isNavigating && currentLocation) {
      setDistanceRemaining(calculateDistanceKm(currentLocation, destination));

      if (previousDestinationRef.current !== destination) {
        previousDestinationRef.current = destination;
        refreshNavigationRoute(currentLocation, true);
      }
    }
  }, [currentLocation, destination, isNavigating, refreshNavigationRoute]);

  useEffect(() => stopNavigation, [stopNavigation]);

  const speedLabel = useMemo(() => {
    if (speed == null || Number.isNaN(speed)) {
      return 'Speed unavailable';
    }

    return `${(speed * 3.6).toFixed(1)} km/h`;
  }, [speed]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('live_navigator_state_change', {
          detail: {
            isNavigating,
            currentLocation,
            navigationRoute,
            speedLabel,
          },
        })
      );
    }
  }, [currentLocation, isNavigating, navigationRoute, speedLabel]);

  return (
    <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {isNavigating ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Live GPS Active
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Auto-centering at zoom 18 for field navigation.
              </p>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                stopNavigation();
              }}
              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-red-700"
            >
              Stop
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-slate-100 p-2">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Distance Remaining
              </span>
              <span className="mt-0.5 block text-lg font-black text-slate-900">
                {formatDistance(distanceRemaining)}
              </span>
            </div>
            <div className="rounded-xl bg-slate-100 p-2">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Speed
              </span>
              <span className="mt-0.5 block text-lg font-black text-slate-900">
                {speedLabel}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500">
            {isRouteRefreshing
              ? 'Refreshing best route...'
              : 'Route refreshes every 10 seconds or after 50 m movement.'}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Live Navigator Mode
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Click a destination on the map, then start GPS tracking for 2-wheeler
              navigation.
            </p>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              startNavigation();
            }}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={!canUseGeolocation}
          >
            Start Navigation
          </button>
        </div>
      )}

      {locationError && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          {locationError}
        </div>
      )}
    </div>
  );
}

export function LiveNavigatorMapOverlay({ liveNavigation }) {
  const [navState, setNavState] = useState(
    liveNavigation || {
      isNavigating: false,
      currentLocation: null,
      navigationRoute: [],
      speedLabel: '',
    }
  );

  useEffect(() => {
    if (liveNavigation) {
      setNavState(liveNavigation);
    }
  }, [liveNavigation]);

  useEffect(() => {
    const handleUpdate = (e) => {
      if (e?.detail) {
        setNavState(e.detail);
      }
    };
    window.addEventListener('live_navigator_state_change', handleUpdate);
    return () => {
      window.removeEventListener('live_navigator_state_change', handleUpdate);
    };
  }, []);

  const { isNavigating, currentLocation, navigationRoute, speedLabel } = navState;

  return (
    <>
      <NavigationAutoCenter
        currentLocation={currentLocation}
        isNavigating={isNavigating}
      />

      {navigationRoute?.length > 0 && (
        <Polyline
          positions={navigationRoute}
          pathOptions={{ color: '#0ea5e9', opacity: 0.9, weight: 7 }}
        >
          <Popup>
            <div className="p-1 text-xs">
              <span className="block font-bold text-sky-700">
                Live GPS Navigation Route
              </span>
              <span>Route recalculates as the rider moves.</span>
            </div>
          </Popup>
        </Polyline>
      )}

      {currentLocation && (
        <Marker position={currentLocation} icon={bikeMarkerIcon}>
          <Popup>
            <div className="p-1 text-xs">
              <span className="block font-bold text-emerald-700">
                🛵 Field Worker Location
              </span>
              <span className="block text-slate-600">{speedLabel}</span>
              <span className="mt-1 block font-mono text-[11px] text-slate-500">
                {currentLocation[0].toFixed(5)}, {currentLocation[1].toFixed(5)}
              </span>
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
}

export default LiveNavigator;
