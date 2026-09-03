import MapViewer from '../components/MapViewer';

const mockActiveVehicles = [
  {
    id: 'veh-1',
    name: 'Relief Truck 101',
    latitude: 26.1445,
    longitude: 91.7362,
    status: 'In Transit',
    driverName: 'Arjun Das',
  },
  {
    id: 'veh-2',
    name: 'Medical Van 204',
    latitude: 25.5788,
    longitude: 91.8933,
    status: 'Awaiting Dispatch',
    driverName: 'Meera Sharma',
  },
  {
    id: 'veh-3',
    name: 'Supply Carrier 309',
    latitude: 27.0844,
    longitude: 93.6053,
    status: 'Delivering Supplies',
    driverName: 'Tashi Norbu',
  },
];

function Dashboard() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-3 text-slate-600">
          Monitor active relief vehicles across the North Eastern Region of India.
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Active Vehicle Map</h2>
          <p className="text-sm text-slate-600">
            Live map view with mock active vehicle positions.
          </p>
        </div>

        <MapViewer activeVehicles={mockActiveVehicles} />
      </section>
    </div>
  );
}

export default Dashboard;