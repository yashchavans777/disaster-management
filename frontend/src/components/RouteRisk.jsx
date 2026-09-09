import { useEffect, useMemo, useState } from 'react';

const FASTAPI_URL = import.meta.env.VITE_FASTAPI_URL || 'http://localhost:8000';

const riskStyles = {
  high: 'border-red-300 bg-red-50 text-red-800',
  moderate: 'border-yellow-300 bg-yellow-50 text-yellow-800',
  low: 'border-green-300 bg-green-50 text-green-800',
};

const riskBadgeStyles = {
  high: 'bg-red-600 text-white',
  moderate: 'bg-yellow-500 text-yellow-950',
  low: 'bg-green-600 text-white',
};

function normalizeRiskLevel(level) {
  const normalized = String(level || 'moderate').toLowerCase();
  if (normalized === 'medium') return 'moderate';
  if (['high', 'moderate', 'low'].includes(normalized)) return normalized;
  return 'moderate';
}

function RouteRisk({ destination }) {
  const [riskData, setRiskData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!destination) {
      setRiskData(null);
      return undefined;
    }

    const controller = new AbortController();

    const evaluateRisk = async () => {
      try {
        setIsLoading(true);
        setError('');

        const response = await fetch(`${FASTAPI_URL}/evaluate-risk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: destination[0], lng: destination[1] }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Risk API returned HTTP ${response.status}`);
        }

        const data = await response.json();
        setRiskData(data);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to evaluate AI risk.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    evaluateRisk();

    return () => controller.abort();
  }, [destination]);

  const riskLevel = useMemo(
    () => normalizeRiskLevel(riskData?.risk_level || riskData?.riskLevel),
    [riskData]
  );

  if (!destination) return null;

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-[1000] w-[min(92vw,360px)]">
      <div
        className={`pointer-events-auto rounded-2xl border p-3 shadow-xl backdrop-blur-md ${
          riskStyles[riskLevel] || riskStyles.moderate
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] opacity-80">
              AI Predictive Risk
            </p>
            <h3 className="mt-1 text-sm font-black text-slate-950">
              {isLoading
                ? 'Evaluating live weather + RAG...'
                : 'Location Risk Assessment'}
            </h3>
          </div>

          <span
            className={`rounded-full px-2.5 py-1 text-xs font-black uppercase shadow-sm ${
              riskBadgeStyles[riskLevel] || riskBadgeStyles.moderate
            }`}
          >
            {isLoading ? '...' : riskLevel}
          </span>
        </div>

        {error ? (
          <p className="mt-2 text-xs font-semibold text-red-700">{error}</p>
        ) : (
          <p className="mt-2 text-xs leading-relaxed text-slate-700">
            {riskData?.justification ||
              'The AI engine will combine OpenWeatherMap live metrics with Silchar historical disaster context.'}
          </p>
        )}

        <p className="mt-2 font-mono text-[10px] text-slate-500">
          {destination[0].toFixed(5)}, {destination[1].toFixed(5)}
        </p>
      </div>
    </div>
  );
}

export default RouteRisk;
