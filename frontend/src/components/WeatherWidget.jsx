import { useEffect, useState } from 'react';
import {
  Cloud,
  CloudRain,
  Sun,
  Thermometer,
  Wind,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

const FASTAPI_URL = import.meta.env.VITE_FASTAPI_URL || 'http://localhost:8000';

function WeatherWidget() {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);
        setError(null);
        // Call FastAPI endpoint directly
        const response = await fetch(`${FASTAPI_URL}/api/weather/silchar`);
        if (!response.ok) {
          throw new Error('Failed to fetch weather data');
        }
        const data = await response.json();
        setWeatherData(data);
      } catch (err) {
        console.error('Weather fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    // Refresh every 30 mins
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !weatherData) {
    return (
      <div className="flex min-h-[160px] animate-pulse items-center justify-center rounded-xl bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">
          Loading Silchar weather...
        </p>
      </div>
    );
  }

  if (error && !weatherData) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
        <p className="text-sm font-medium text-red-600">
          Weather unavailable: {error}
        </p>
      </div>
    );
  }

  const { current, forecast, rain_expected_in_next_48h } = weatherData;

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        {/* Current Weather */}
        <div>
          <h2 className="text-lg font-bold text-slate-900">Silchar, Assam</h2>
          <p className="text-sm font-medium text-slate-500">
            Live Weather & 2-Day Forecast
          </p>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl">
              {current.emoji}
            </div>
            <div>
              <div className="flex items-center gap-1">
                <Thermometer className="h-5 w-5 text-slate-400" />
                <span className="text-3xl font-black text-slate-800">
                  {current.temperature_c}°C
                </span>
              </div>
              <p className="text-sm font-medium text-slate-600">
                {current.condition}
              </p>
            </div>
          </div>
        </div>

        {/* Forecast & Alert */}
        <div className="flex flex-col items-end gap-3 md:min-w-[280px]">
          {/* Status Badge */}
          {rain_expected_in_next_48h ? (
            <div className="inline-flex animate-pulse items-center gap-2 rounded-lg border border-red-500 bg-red-600 px-3 py-2 text-sm font-bold text-white shadow-sm ring-2 ring-red-500/20">
              <AlertTriangle className="h-4 w-4" />
              ⚠️ HIGH ALERT: Rain Expected in Next 48 Hours - Flood Risk
              Elevated
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-bold text-green-700 shadow-sm">
              <CheckCircle2 className="h-4 w-4" />
              Clear Weather
            </div>
          )}

          {/* 2-Day Forecast Cards */}
          <div className="mt-2 flex w-full gap-3">
            {forecast?.slice(0, 2).map((day, idx) => (
              <div
                key={idx}
                className="flex flex-1 flex-col items-center rounded-xl border border-slate-100 bg-slate-50 p-3"
              >
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  {day.day_label}
                </p>
                <span className="my-1 text-2xl">{day.emoji}</span>
                <p
                  className="text-[10px] font-medium text-slate-600 text-center leading-tight line-clamp-1"
                  title={day.condition}
                >
                  {day.condition}
                </p>
                <div className="mt-1 flex items-center gap-1 text-xs font-bold text-blue-600">
                  <CloudRain className="h-3 w-3" />
                  {day.precipitation_probability}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WeatherWidget;
