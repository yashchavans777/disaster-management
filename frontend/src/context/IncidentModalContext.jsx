import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import apiClient from '../api/apiClient';
import { getApiErrorMessage } from '../api/apiError';

const INCIDENT_QUEUE_KEY = 'dm-offline-incident-queue';

/**
 * Offline incident queue (localStorage) — shared by this global provider and
 * the Dashboard's back-online auto-sync, so reports survive page reloads.
 */
const readQueuedIncidents = () => {
  try {
    const cachedValue = localStorage.getItem(INCIDENT_QUEUE_KEY);
    if (!cachedValue) return [];
    const parsedValue = JSON.parse(cachedValue);
    return Array.isArray(parsedValue) ? parsedValue : [];
  } catch {
    return [];
  }
};

const writeQueuedIncidents = (incidents) => {
  localStorage.setItem(INCIDENT_QUEUE_KEY, JSON.stringify(incidents));
};

const buildIncidentPayload = ({ type, description, latitude, longitude }) => ({
  type,
  title: `${type.charAt(0).toUpperCase()}${type.slice(1)} reported from dashboard`,
  description,
  severity: type === 'roadblock' ? 'medium' : 'high',
  location: {
    lat: latitude,
    lng: longitude,
    address: 'Reported from live operations dashboard',
  },
  status: 'reported',
});

const IncidentModalContext = createContext(null);

/**
 * Global Report Incident state.
 * The modal is hosted at the App root so the emergency "Report Incident"
 * action works from ANY page (Navbar button, Dashboard FAB, future pages) —
 * including while offline (reports queue in localStorage and auto-sync when
 * connectivity returns).
 */
export function IncidentModalProvider({ children }) {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSubmittingIncident, setIsSubmittingIncident] = useState(false);

  const openReportModal = useCallback(() => setIsReportModalOpen(true), []);
  const closeReportModal = useCallback(() => setIsReportModalOpen(false), []);

  const submitIncident = useCallback(async ({ type, description, latitude, longitude }) => {
    const payload = buildIncidentPayload({ type, description, latitude, longitude });

    if (!navigator.onLine) {
      const queuedIncidents = readQueuedIncidents();
      writeQueuedIncidents([...queuedIncidents, payload]);
      toast('You are offline. Incident saved for later sync.', { icon: '📡' });
      setIsReportModalOpen(false);
      return;
    }

    try {
      setIsSubmittingIncident(true);
      await apiClient.post('/incidents', payload);
      toast.success(
        'Incident reported. Agentic loop triggered — monitoring for rerouting...'
      );
      setIsReportModalOpen(false);
    } catch (error) {
      const queuedIncidents = readQueuedIncidents();
      writeQueuedIncidents([...queuedIncidents, payload]);
      toast.error(
        getApiErrorMessage(
          error,
          'Failed to submit incident report. Saved for retry.'
        )
      );
    } finally {
      setIsSubmittingIncident(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      isReportModalOpen,
      isSubmittingIncident,
      openReportModal,
      closeReportModal,
      submitIncident,
    }),
    [
      isReportModalOpen,
      isSubmittingIncident,
      openReportModal,
      closeReportModal,
      submitIncident,
    ]
  );

  return (
    <IncidentModalContext.Provider value={value}>
      {children}
    </IncidentModalContext.Provider>
  );
}

export function useIncidentModal() {
  const context = useContext(IncidentModalContext);
  if (!context) {
    throw new Error('useIncidentModal must be used within an IncidentModalProvider');
  }
  return context;
}

export { INCIDENT_QUEUE_KEY, readQueuedIncidents, writeQueuedIncidents, buildIncidentPayload };
