import { Route, Routes } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { useRegisterSW } from 'virtual:pwa-register/react';

import Dashboard from './pages/Dashboard';
import DriverView from './pages/DriverView';
import Login from './pages/Login';
import HazardMap from './components/HazardMap';
import Navbar from './components/Navbar';
import NavigationSidebar from './components/NavigationSidebar';
import ReportIncidentModal from './components/ReportIncidentModal';
import { AuthProvider } from './context/AuthContext';
import { IncidentModalProvider, useIncidentModal } from './context/IncidentModalContext';
import { LanguageProvider } from './context/LanguageContext';

function AppContent() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 lg:flex">
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <NavigationSidebar />

      <div className="flex flex-1 flex-col min-w-0">
        <Navbar />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route
                path="/hazard-zones"
                element={
                  <div className="flex min-h-full flex-col gap-6">
                    <HazardMap />
                  </div>
                }
              />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Login />} />
              <Route path="/driver" element={<DriverView />} />
            </Routes>
          </div>
        </main>
      </div>

      {/* Global Report Incident modal host — reachable from ANY page via the
          Navbar button / Sidebar button / Dashboard FAB through IncidentModalContext. */}
      <GlobalReportIncidentModal />
    </div>
  );
}

// The Report Incident modal is wired to the global context so submission
// (including the offline queue) works everywhere, not only on the Dashboard.
function GlobalReportIncidentModal() {
  const {
    isReportModalOpen,
    isSubmittingIncident,
    closeReportModal,
    submitIncident,
  } = useIncidentModal();

  return (
    <ReportIncidentModal
      isOpen={isReportModalOpen}
      isSubmitting={isSubmittingIncident}
      onClose={closeReportModal}
      onSubmit={submitIncident}
    />
  );
}

function App() {
  const { updateServiceWorker } = useRegisterSW({
    immediate: true,
    onRegisteredSW() {},
    onRegisterError() {},
    onNeedRefresh() {
      toast(
        (t) => (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
            <span className="text-sm font-medium text-slate-800">
              New update available!
            </span>
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                updateServiceWorker(true);
              }}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        ),
        { duration: Infinity }
      );
    },
    onOfflineReady() {
      toast.success('App is ready to work offline.');
    },
  });

  return (
    <AuthProvider>
      <LanguageProvider>
        <IncidentModalProvider>
          <AppContent />
        </IncidentModalProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
