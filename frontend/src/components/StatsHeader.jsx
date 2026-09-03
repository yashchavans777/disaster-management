import { TrendingUp, Wind, Truck } from 'lucide-react';

const statConfig = [
  {
    label: 'Total Fleet',
    value: '142',
    icon: <Truck className="h-6 w-6 text-blue-500" />
  },
  {
    label: 'Active Hazards',
    value: '7',
    icon: <Wind className="h-6 w-6 text-amber-500" />
  },
  {
    label: 'Safe Routes Calculated',
    value: '56',
    icon: <TrendingUp className="h-6 w-6 text-green-500" />
  }
];

export default function StatsHeader({ stats }) {
  const displayStats = (stats || statConfig).map((stat) => {
    const fallbackConfig = statConfig.find((item) => item.label === stat.label);
    return {
      ...fallbackConfig,
      ...stat,
      icon: stat.icon || fallbackConfig?.icon
    };
  });

  return (
    <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {displayStats.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-4 rounded-xl bg-white px-6 py-4 shadow-sm ring-1 ring-gray-200 transition-shadow hover:shadow-md"
        >
          <div className="flex-shrink-0">{stat.icon}</div>
          <div className="flex-1">
            <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
