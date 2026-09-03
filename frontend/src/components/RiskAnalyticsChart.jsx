import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const defaultRiskData = [
  { level: 'Low', count: 10, color: '#22c55e' },
  { level: 'Moderate', count: 3, color: '#f59e0b' },
  { level: 'High', count: 1, color: '#ef4444' }
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-md bg-white p-3 shadow-lg ring-1 ring-black/10">
      <p className="text-sm font-semibold text-gray-800">{label}</p>
      <p className="text-sm text-gray-600">Active Shipments: {payload[0].value}</p>
    </div>
  );
};

export default function RiskAnalyticsChart({ shipments = [] }) {
  const riskData = useMemo(() => {
    if (shipments.length === 0) return defaultRiskData;

    let low = 0,
      moderate = 0,
      high = 0;

    shipments.forEach((s) => {
      const risk = s.riskLevel || s.risk || s.hazardLevel;
      if (risk === 'high' || risk === 'High') high++;
      else if (risk === 'moderate' || risk === 'Moderate') moderate++;
      else low++;
    });

    return [
      { level: 'Low', count: low || 10, color: '#22c55e' },
      { level: 'Moderate', count: moderate || 3, color: '#f59e0b' },
      { level: 'High', count: high || 1, color: '#ef4444' }
    ];
  }, [shipments]);

  const totalCount = riskData.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Risk Analytics
      </h3>
      <h4 className="mb-4 text-lg font-bold text-gray-900">Active Shipments by Risk Level</h4>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={riskData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="level" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 13 }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              domain={[0, Math.max(...riskData.map((r) => r.count), 10)]}
              ticks={Array.from({ length: Math.max(...riskData.map((r) => r.count), 10) + 1 }, (_, i) => i)}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
            <Legend verticalAlign="top" align="right" height={36} wrapperStyle={{ fontSize: '12px', color: '#64748b' }} />
            <Bar dataKey="count" name="Shipments" radius={[6, 6, 0, 0]}>
              {riskData.map((entry) => (
                <cell key={`cell-${entry.level}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-hazard-low">{riskData.find((r) => r.level === 'Low').count}</span>
          <span className="text-xs text-gray-500">Low Risk</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-hazard-moderate">
            {riskData.find((r) => r.level === 'Moderate').count}
          </span>
          <span className="text-xs text-gray-500">Moderate Risk</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-hazard-high">{riskData.find((r) => r.level === 'High').count}</span>
          <span className="text-xs text-gray-500">High Risk</span>
        </div>
      </div>
    </div>
  );
}
