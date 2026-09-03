import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const ALERT_MESSAGES = {
  en: 'Alert! Hazard detected ahead. Rerouting to a safe path.',
  hi: 'Savdhaan! Aage khatra hai. Naya rasta chuna jaa raha hai.',
};

const LANGUAGE_LABELS = {
  en: 'English',
  hi: 'Hindi',
};

export const playVoiceAlert = (message, langCode = 'en') => {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return false;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = langCode === 'hi' ? 'hi-IN' : 'en-US';
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.volume = 1;

  window.speechSynthesis.speak(utterance);
  return true;
};

function DriverView() {
  const [language, setLanguage] = useState('en');
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Connecting');
  const [latestAlert, setLatestAlert] = useState(null);
  const languageRef = useRef(language);
  const audioEnabledRef = useRef(audioEnabled);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setConnectionStatus('Connected');
    });

    socket.on('disconnect', () => {
      setConnectionStatus('Disconnected');
    });

    socket.on('connect_error', () => {
      setConnectionStatus('Connection unavailable');
    });

    socket.on('route_hazard_alert', (payload = {}) => {
      const activeLanguage = languageRef.current;
      const alertMessage = ALERT_MESSAGES[activeLanguage];

      setLatestAlert({
        message: alertMessage,
        payload,
        receivedAt: new Date().toLocaleTimeString(),
      });

      if (audioEnabledRef.current) {
        playVoiceAlert(alertMessage, activeLanguage);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('route_hazard_alert');
      socket.disconnect();
    };
  }, []);

  const enableAudio = () => {
    setAudioEnabled(true);

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const toggleLanguage = () => {
    setLanguage((currentLanguage) => (currentLanguage === 'en' ? 'hi' : 'en'));
  };

  const testAlert = () => {
    enableAudio();
    playVoiceAlert(ALERT_MESSAGES[language], language);
  };

  return (
    <section className="space-y-6" onClick={enableAudio}>
      <div className="rounded-2xl bg-slate-950 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">Driver View</p>
            <h1 className="mt-2 text-3xl font-bold">Live Route Safety Alerts</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Receive multilingual hazard alerts with browser-based voice guidance while rerouting to safer paths.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleLanguage();
                enableAudio();
              }}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              English | Hindi: {LANGUAGE_LABELS[language]}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                testAlert();
              }}
              className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              Enable Audio / Test
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-500">Socket Status</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{connectionStatus}</p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-500">Voice Alerts</p>
          <p className={`mt-2 text-2xl font-bold ${audioEnabled ? 'text-emerald-600' : 'text-amber-600'}`}>
            {audioEnabled ? 'Enabled' : 'Tap to Enable'}
          </p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-500">Language</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{LANGUAGE_LABELS[language]}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Latest Hazard Alert</h2>
            <p className="mt-1 text-sm text-slate-500">
              Voice playback starts only after the driver clicks anywhere on this screen or presses the enable button.
            </p>
          </div>
          {latestAlert?.receivedAt ? (
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
              {latestAlert.receivedAt}
            </span>
          ) : null}
        </div>

        {latestAlert ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5">
            <p className="text-lg font-bold text-red-800">{latestAlert.message}</p>
            {latestAlert.payload?.location || latestAlert.payload?.hazardType ? (
              <p className="mt-2 text-sm text-red-700">
                {latestAlert.payload.hazardType ? `Hazard: ${latestAlert.payload.hazardType}. ` : ''}
                {latestAlert.payload.location ? `Location: ${latestAlert.payload.location}.` : ''}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
            No route hazard alerts received yet.
          </div>
        )}
      </div>
    </section>
  );
}

export default DriverView;