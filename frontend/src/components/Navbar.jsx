import { useEffect, useRef, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Brain,
  Check,
  ChevronDown,
  Globe,
  Languages,
  Radio,
  Shield,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useIncidentModal } from '../context/IncidentModalContext';
import { useLanguage } from '../context/LanguageContext';

export default function Navbar({ onOpenIncidentModal, onEvaluateRisks, isEvaluating = false }) {
  const { selectedLanguage, setSelectedLanguage, languages, t } = useLanguage();
  const { openReportModal } = useIncidentModal();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const dropdownRef = useRef(null);

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLanguage = languages.find((l) => l.code === selectedLanguage) || languages[0];

  return (
    <header className="sticky top-0 z-[1100] w-full border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Branding & Low-network Status */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-base leading-none">
                SmartLogistics NER
              </span>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                SIH26002
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Disaster Response & Multilingual Logistics Control
            </p>
          </div>
        </div>

        {/* Right: Key UI Action buttons and Bhashini Language Switcher */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Network / Offline Mode Indicator */}
          <div
            className={`hidden md:flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
            title={isOnline ? 'Online - Bhashini ULCA API Active' : 'Offline Mode - Local Cached Translations Active'}
          >
            {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            <span>{isOnline ? 'Online' : 'Low Network (Cached)'}</span>
          </div>

          {/* Key UI Button 1: Evaluate Route Risks (Wrapped in translation context) */}
          {onEvaluateRisks && (
            <button
              type="button"
              onClick={onEvaluateRisks}
              disabled={isEvaluating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition disabled:opacity-50"
              title="Evaluate route risks with AI deep learning model"
            >
              <Brain className="h-3.5 w-3.5 text-blue-600" />
              <span className="hidden sm:inline">
                {isEvaluating ? 'Evaluating...' : t('Evaluate Route Risks')}
              </span>
            </button>
          )}

          {/* Key UI Button 2: Report Incident — always-visible emergency action.
              Uses the global IncidentModalContext so it works from every page. */}
          <button
            type="button"
            onClick={onOpenIncidentModal || openReportModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm ring-1 ring-rose-700/20 transition focus:outline-none focus:ring-4 focus:ring-rose-200"
            title="Report road incident or hazard"
          >
            <AlertOctagon className="h-3.5 w-3.5" />
            <span>{t('Report Incident')}</span>
          </button>

          {/* Sleek Tailwind CSS Language Switcher Dropdown Menu */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-xs hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition"
              aria-label="Select interface language (Bhashini API)"
            >
              <Languages className="h-4 w-4 text-indigo-600" />
              <span className="text-base leading-none">{currentLanguage.flag}</span>
              <span className="font-bold text-slate-900">{currentLanguage.nativeName}</span>
              <span className="text-slate-400 text-[10px] hidden sm:inline">({currentLanguage.label})</span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 z-[1200] animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <Globe className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Bhashini Multilingual UI</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Govt. of India ULCA Language Pipeline
                  </p>
                </div>

                <div className="py-1 space-y-0.5">
                  {languages.map((lang) => {
                    const isSelected = selectedLanguage === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          setSelectedLanguage(lang.code);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition ${
                          isSelected
                            ? 'bg-indigo-50 font-bold text-indigo-700'
                            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base leading-none">{lang.flag}</span>
                          <div className="text-left">
                            <span className="block font-semibold text-slate-900">
                              {lang.nativeName}
                            </span>
                            <span className="block text-[10px] text-slate-500">
                              {lang.label} ({lang.code})
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <Check className="h-4 w-4 text-indigo-600 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-1 border-t border-slate-100 px-3 py-1.5 bg-slate-50/70 rounded-xl text-[10px] text-slate-500 flex items-center justify-between">
                  <span>Offline cache active</span>
                  <span className="font-mono font-bold text-indigo-600">ULCA v2</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
