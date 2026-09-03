import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';

const NORTH_EAST_INDIA_CENTER = [26.2006, 92.9376];
const riskColors = {
  low: '#16a34a',
  moderate: '#eab308',
  high: '#dc2626',
};

function MapViewer({ activeVehicles = [], routes = [] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <MapContainer
        center={NORTH_EAST_INDIA_CENTER}
        zoom={7}
        scrollWheelZoom
        className="h-[420px] w-full"
      >
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

        {activeVehicles.map((vehicle) => (
          <Marker key={vehicle.id} position={[vehicle.latitude, vehicle.longitude]}>
            <Popup>
              <div className="min-w-[180px]">
                <h3 className="font-semibold text-slate-900">{vehicle.name}</h3>
                <p className="text-sm text-slate-600">Status: {vehicle.status}</p>
                <p className="text-sm text-slate-600">Driver: {vehicle.driverName}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export default MapViewer;