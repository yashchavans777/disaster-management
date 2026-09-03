import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';

const NORTH_EAST_INDIA_CENTER = [26.2006, 92.9376];

function MapViewer({ activeVehicles = [] }) {
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