import { useState } from 'react';
import { Link } from 'react-router-dom';

const navItems = [
  { name: 'Dashboard', icon: 'dashboard', path: '/', active: true },
  { name: 'Incidents', icon: 'incident', path: '/incidents', active: false },
  { name: 'Shipments', icon: 'shipments', path: '/shipments', active: false },
  { name: 'Hazards', icon: 'hazards', path: '/hazards', active: false },
  { name: 'Analytics', icon: 'analytics', path: '/analytics', active: false },
  { name: 'Settings', icon: 'settings', path: '/settings', active: false }
];

const iconMap = {
  dashboard: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10h14V10" />
    </svg>
  ),
  incidents: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9V3l-9 11h3v5h5v-3h1v3h5v-5h3z" />
    </svg>
  ),
  shipments: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 9h10a2 2 0 012 2v5a2 2 0 01-2 2H7a2 2 0 01-2-2v-5a2 2 0 012-2z" />
    </svg>
  ),
  hazards: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 8v1m-6 5.5a9 9 0 1112 0m-6-5.5a3 3 0 100-6 3 3 0 000 6z" />
    </svg>
  ),
  analytics: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l3-3 3 3v13m-6 0h6" />
    </svg>
  ),
  settings: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l2.4 7.4h7.4l-6 4.8 2.2 7.2-6-4.2-6 4.2 2.2-7.2H2.6z" />
    </svg>
  )
};

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  const ChevronIcon = (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );

  const ChevronCollapsedIcon = (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );

  return (
    <aside
      className={`${
        collapsed ? 'w-16' : 'w-64'
      } flex flex-col gap-y-5 overflow-y-auto bg-sidebar-900 text-white shadow-xl transition-all duration-300`}
    >
      <div className="flex h-16 items-center justify-between px-4">
        {!collapsed && <h1 className="text-xl font-bold text-white">Disaster Management</h1>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-1.5 text-sidebar-300 hover:bg-sidebar-700 hover:text-white"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      <nav className="flex flex-col gap-1 px-2">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              item.active
                ? 'bg-sidebar-700 text-white'
                : 'text-sidebar-300 hover:bg-sidebar-800 hover:text-white'
            }`}
            title={item.name}
          >
            <span className="text-center">{iconMap[item.icon]}</span>
            {!collapsed && <span>{item.name}</span>}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
