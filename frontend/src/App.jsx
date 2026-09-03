import { LayoutDashboard, LogIn, Truck } from 'lucide-react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useRegisterSW } from 'virtual:pwa-register/react';

import Dashboard from './pages/Dashboard';
import DriverView from './pages/DriverView';
import Login from './pages/Login';

const navigationItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/driver', label: 'Driver View', icon: Truck },
  { to: '/login', label: 'Login', icon: LogIn },
];

function App() {
  useRegisterSW({
    immediate: true,
    onRegisteredSW() {},
    onRegisterError() {},
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 lg:flex">
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />

      <aside className="border-b border-slate-200 bg-white lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col px-4 py-5 sm:px-6">
          <div className="px-2 pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">Control Center</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Disaster Management</h1>
            <p className="mt-2 text-sm text-slate-500">Monitor routes, drivers, and response activity in one place.</p>
          </div>

          <nav className="flex flex-1 flex-col gap-2">
            {navigationItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  [
                    'inline-flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition',
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  ].join(' ')
                }
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      <main className="min-h-screen flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/driver" element={<DriverView />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;