import { useState } from 'react';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Compass,
  MapPin,
} from 'lucide-react';

const DISTRICT_STATUSES = [
  {
    id: 'cachar',
    district: 'Cachar',
    region: 'Barak Valley, Assam',
    status: 'Severely Disrupted - Barak Overflow',
    indicator: '🔴',
    severity: 'critical',
    badgeColor: 'bg-red-100 text-red-700 border-red-200',
    dotColor: 'bg-red-500',
    keyCorridor: 'NH-6 (Silchar Bypass & Betukandi Embankment)',
    condition: 'Barak River water level exceeding 19.83m danger threshold. Submerged low-lying highways.',
    advisory: 'Heavy relief convoys diverted via Badarpur auxiliary link. Speed capped at 20 km/h.',
    lastChecked: '2 mins ago',
  },
  {
    id: 'dima-hasao',
    district: 'Dima Hasao',
    region: 'Central Assam Hills',
    status: 'High Risk - Landslide Watch',
    indicator: '🟡',
    severity: 'warning',
    badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
    dotColor: 'bg-amber-500',
    keyCorridor: 'NH-27 (Jatinga-Haflong Ridge & Lumding-Badarpur link)',
    condition: 'Soil saturation above 82%. Loose debris and rockfall hazard on hill slopes.',
    advisory: 'Daylight convoy operations only. Escort vehicles mandated at Km 51/2 bottleneck.',
    lastChecked: '5 mins ago',
  },
  {
    id: 'kamrup',
    district: 'Kamrup',
    region: 'Lower Assam Valley',
    status: 'Normal',
    indicator: '🟢',
    severity: 'normal',
    badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dotColor: 'bg-emerald-500',
    keyCorridor: 'NH-27 Gateway & Guwahati Logistics Hub',
    condition: 'Optimal road visibility and zero major waterlogging reported.',
    advisory: 'Primary dispatch corridor operational. Unrestricted movement for all cargo classes.',
    lastChecked: '1 min ago',
  },
];

function ConnectivityMatrix() {
  const [filter, setFilter] = useState('all');

  const filteredDistricts = DISTRICT_STATUSES.filter((d) => {
    if (filter === 'disrupted') return d.severity === 'critical' || d.severity === 'warning';
    if (filter === 'normal') return d.severity === 'normal';
    return true;
  });

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Activity className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                District Connectivity Matrix
              </h2>
              <p className="text-xs text-slate-500">
                Real-time regional logistics corridor status across key North East gateways.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
            <button
              onClick={() => setFilter('all')}
              className={`rounded-md px-2.5 py-1 transition ${
                filter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All (3)
            </button>
            <button
              onClick={() => setFilter('disrupted')}
              className={`rounded-md px-2.5 py-1 transition ${
                filter === 'disrupted'
                  ? 'bg-white text-red-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Alerts (2)
            </button>
            <button
              onClick={() => setFilter('normal')}
              className={`rounded-md px-2.5 py-1 transition ${
                filter === 'normal'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Normal (1)
            </button>
          </div>

          <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Sensors Online
          </span>
        </div>
      </div>

      {/* Connectivity Table (Desktop) / Cards (Mobile) */}
      <div className="mt-5 overflow-hidden">
        {/* Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">District / Region</th>
                <th className="py-3 px-4">Operational Status</th>
                <th className="py-3 px-4">Monitored Corridor</th>
                <th className="py-3 px-4">Ground Condition & Advisory</th>
                <th className="py-3 px-4 text-right">Last Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredDistricts.map((item) => (
                <tr
                  key={item.id}
                  className="transition hover:bg-slate-50/80"
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-900 block">
                          {item.district}
                        </span>
                        <span className="text-xs text-slate-500">
                          {item.region}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="inline-flex items-center gap-2">
                      <span className="text-base leading-none">{item.indicator}</span>
                      <span
                        className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold border ${item.badgeColor}`}
                      >
                        {item.status}
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-xs font-medium text-slate-700 max-w-[220px]">
                    <div className="flex items-center gap-1 text-slate-900 font-semibold mb-0.5">
                      <Compass className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      <span>{item.keyCorridor}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 max-w-[280px]">
                    <p className="text-xs text-slate-700 font-medium">
                      {item.condition}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      💡 {item.advisory}
                    </p>
                  </td>

                  <td className="py-3.5 px-4 text-right text-xs text-slate-500 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>{item.lastChecked}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Card View (Mobile) */}
        <div className="grid gap-3 md:hidden">
          {filteredDistricts.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 shadow-2xs"
            >
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.indicator}</span>
                  <div>
                    <h3 className="font-bold text-slate-900">{item.district}</h3>
                    <p className="text-[11px] text-slate-500">{item.region}</p>
                  </div>
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-[11px] font-semibold border ${item.badgeColor}`}
                >
                  {item.severity.toUpperCase()}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">Status: </span>
                  <span className="font-semibold text-slate-900">
                    {item.status}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Corridor: </span>
                  <span className="text-slate-800">{item.keyCorridor}</span>
                </div>
                <div className="rounded bg-white p-2.5 border border-slate-200/80 text-[11px]">
                  <p className="text-slate-700">
                    <strong>Condition:</strong> {item.condition}
                  </p>
                  <p className="text-slate-500 mt-1">
                    <strong>Advisory:</strong> {item.advisory}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ConnectivityMatrix;
