import { Link, Route, Routes } from 'react-router-dom';

import Dashboard from './pages/Dashboard';
import Login from './pages/Login';

function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
          <Link className="font-semibold text-blue-600" to="/">
            Dashboard
          </Link>
          <Link className="font-semibold text-slate-600" to="/login">
            Login
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;