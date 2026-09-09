import { AlertTriangle, LayoutDashboard, LogIn, LogOut, Shield, Truck, User, UserPlus } from 'lucide-react';
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { useRegisterSW } from 'virtual:pwa-register/react';

import Dashboard from './pages/Dashboard';
import DriverView from './pages/DriverView';
import Login from './pages/Login';
import HazardMap from './components/HazardMap';
import Navbar from './components/Navbar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';

function NavigationSidebar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success('Signed out successfully');
    navigate('/login');
  };

  return (
    <aside className="border-b border-slate-200 bg-white lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col px-4 py-5 sm:px-6">
        {/* Brand Header */}
        <div className="px-2 pb-5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <Shield className="h-4 w-4" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-blue-600">
              {t('Control Center')}
            </p>
          </div>
          <h1 className="mt-2 text-xl font-bold text-slate-900">
            Disaster Management
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Real-time incident response & logistics coordination.
          </p>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-1 flex-col gap-1.5">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              [
                'inline-flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-2xs ring-1 ring-blue-100'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')
            }
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>{t('Dashboard')}</span>
          </NavLink>

          <NavLink
            to="/hazard-zones"
            className={({ isActive }) =>
              [
                'inline-flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-2xs ring-1 ring-blue-100'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')
            }
          >
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span>{t('Hazard Zones')}</span>
          </NavLink>

          <NavLink
            to="/driver"
            className={({ isActive }) =>
              [
                'inline-flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-2xs ring-1 ring-blue-100'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')
            }
          >
            <Truck className="h-4 w-4" />
            <span>{t('Driver View')}</span>
          </NavLink>

          {!isAuthenticated ? (
            <>
              <div className="my-2 border-t border-slate-100 pt-2">
                <span className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Authentication
                </span>
              </div>
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  [
                    'inline-flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-2xs ring-1 ring-blue-100'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  ].join(' ')
                }
              >
                <LogIn className="h-4 w-4" />
                <span>Sign In (Login)</span>
              </NavLink>

              <NavLink
                to="/register"
                className={({ isActive }) =>
                  [
                    'inline-flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-2xs ring-1 ring-blue-100'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  ].join(' ')
                }
              >
                <UserPlus className="h-4 w-4" />
                <span>Sign Up (Register)</span>
              </NavLink>
            </>
          ) : (
            <NavLink
              to="/login"
              className={({ isActive }) =>
                [
                  'inline-flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition',
                  isActive
                    ? 'bg-blue-50 text-blue-700 shadow-2xs ring-1 ring-blue-100'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                ].join(' ')
              }
            >
              <User className="h-4 w-4" />
              <span>User Profile</span>
            </NavLink>
          )}
        </nav>

        {/* User Status / Account Footer */}
        {isAuthenticated && user && (
          <div className="mt-auto border-t border-slate-200 pt-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-900">{user.name}</p>
                    <span className="inline-block rounded bg-blue-100 px-1.5 py-0.2 text-[10px] font-medium capitalize text-blue-700">
                      {user.role}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign out"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

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
    </div>
  );
}

function App() {
  useRegisterSW({
    immediate: true,
    onRegisteredSW() {},
    onRegisterError() {},
  });

  return (
    <AuthProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
