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

  // Fallback if weatherData is somehow undefined or missing main data
  if (!weatherData || !weatherData.main) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <p className="text-sm font-medium text-amber-600">
          Weather data is currently unavailable or malformed.
        </p>
      </div>
    );
  }

  // Safely extract OpenWeatherMap fields using optional chaining
  const temperature = weatherData?.main?.temp;
  const condition = weatherData?.weather?.[0]?.main || 'Unknown';
  const description = weatherData?.weather?.[0]?.description || 'No description';
  const cityName = weatherData?.name || 'Silchar';

  const getEmoji = (cond) => {
    switch (cond?.toLowerCase()) {
      case 'clear': return '☀️';
      case 'clouds': return '☁️';
      case 'rain':
      case 'drizzle': return '🌧️';
      case 'thunderstorm': return '⛈️';
      case 'snow': return '❄️';
      default: return '🌤️';
    }
  };

  const emoji = getEmoji(condition);
  const isRaining = ['rain', 'drizzle', 'thunderstorm'].includes(condition?.toLowerCase());

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        {/* Current Weather */}
        <div>
          <h2 className="text-lg font-bold text-slate-900">{cityName}, Assam</h2>
          <p className="text-sm font-medium text-slate-500">
            Live Weather
          </p>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-3xl">
              {emoji}
            </div>
            <div>
              <div className="flex items-center gap-1">
                <Thermometer className="h-5 w-5 text-slate-400" />
                <span className="text-3xl font-black text-slate-800">
                  {temperature ? Math.round(temperature) : '--'}°C
                </span>
              </div>
              <p className="text-sm font-medium text-slate-600 capitalize">
                {description}
              </p>
            </div>
          </div>
        </div>

        {/* Forecast & Alert */}
        <div className="flex flex-col items-end gap-3 md:min-w-[280px]">
          {/* Status Badge */}
          {isRaining ? (
            <div className="inline-flex animate-pulse items-center gap-2 rounded-lg border border-red-500 bg-red-600 px-3 py-2 text-sm font-bold text-white shadow-sm ring-2 ring-red-500/20">
              <AlertTriangle className="h-4 w-4" />
              ⚠️ HIGH ALERT: Rain Expected - Flood Risk Elevated
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-bold text-green-700 shadow-sm">
              <CheckCircle2 className="h-4 w-4" />
              Clear Weather
            </div>
          )}

          {/* Forecast section gracefully omitted for OpenWeatherMap free tier compatibility */}
        </div>
      </div>
    </div>
  );
}

export default WeatherWidget;
