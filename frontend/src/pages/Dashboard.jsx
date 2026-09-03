import { useEffect, useMemo, useState } from 'react';
import apiClient from '../api/apiClient';
import MapViewer from '../components/MapViewer';
import StatsHeader from '../components/StatsHeader';
import RiskAnalyticsChart from '../components/RiskAnalyticsChart';

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

const routeColors = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#dc2626'];

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
        name:
          vehicle?.name ||
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
    .map((shipment, index) => {
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
        coordinates,
        color: routeColors[index % routeColors.length],
      };
    })
    .filter(Boolean);

function Dashboard() {
  const [shipments, setShipments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const fetchShipments = async () => {
      try {
        setIsLoading(true);
        setErrorMessage('');

        const response = await apiClient.get('/shipments');
        const shipmentData = Array.isArray(response.data?.data) ? response.data.data : [];

        if (isMounted) {
          setShipments(shipmentData);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.response?.data?.message || 'Failed to load active shipments.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchShipments();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeShipments = useMemo(
    () => shipments.filter((shipment) => shipment.status !== 'delivered'),
    [shipments]
  );

  const activeVehicles = useMemo(() => mapShipmentsToVehicles(activeShipments), [activeShipments]);
  const activeRoutes = useMemo(() => mapShipmentsToRoutes(activeShipments), [activeShipments]);

  const dashboardStats = useMemo(
    () => [
      { label: 'Total Fleet', value: activeShipments.length },
      { label: 'Active Hazards', value: activeRoutes.length },
      { label: 'Safe Routes Calculated', value: activeRoutes.length }
    ],
    [activeShipments, activeRoutes]
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitor active relief vehicles and risk analytics across the North Eastern Region of India.
        </p>
      </header>

      <StatsHeader stats={dashboardStats} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <RiskAnalyticsChart shipments={activeShipments} />
        </div>

        <div className="lg:col-span-2">
          <section className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Active Vehicle Map</h2>
                <p className="text-sm text-gray-500">
                  Live map view of active shipments and their current route paths.
                </p>
              </div>

              <div className="text-sm text-gray-500">
                Active shipments: <span className="font-semibold text-gray-700">{activeShipments.length}</span>
              </div>
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
      </div>
    </div>
  );
}

export default Dashboard;