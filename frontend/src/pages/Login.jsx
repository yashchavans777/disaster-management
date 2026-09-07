import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Phone,
  Radio,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Truck,
  User,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getApiErrorMessage } from '../api/apiError';

const ROLES = [
  {
    id: 'operator',
    label: 'Control Operator',
    description: 'Incident monitoring & response',
    icon: Radio,
    color: 'border-blue-500 text-blue-600 bg-blue-50',
    demoEmail: 'operator@disaster.org',
  },
  {
    id: 'driver',
    label: 'Logistics Driver',
    description: 'Fleet transport & route tracking',
    icon: Truck,
    color: 'border-amber-500 text-amber-600 bg-amber-50',
    demoEmail: 'driver@disaster.org',
  },
  {
    id: 'manager',
    label: 'Disaster Manager',
    description: 'Resource allocation & analytics',
    icon: ShieldAlert,
    color: 'border-purple-500 text-purple-600 bg-purple-50',
    demoEmail: 'manager@disaster.org',
  },
  {
    id: 'admin',
    label: 'System Admin',
    description: 'Full administrative access',
    icon: ShieldCheck,
    color: 'border-emerald-500 text-emerald-600 bg-emerald-50',
    demoEmail: 'admin@disaster.org',
  },
];

function Login() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, login, register, logout } = useAuth();

  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState(initialMode); // 'login' | 'register'

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    role: 'operator',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleModeSwitch = (newMode) => {
    setMode(newMode);
    setSearchParams(newMode === 'register' ? { mode: 'register' } : {});
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleRoleSelect = (roleId) => {
    setFormData((prev) => ({ ...prev, role: roleId }));
  };

  const handleDemoQuickFill = (roleItem) => {
    setFormData((prev) => ({
      ...prev,
      email: roleItem.demoEmail,
      password: `${roleItem.id}123`,
      role: roleItem.id,
      name: `${roleItem.label} User`,
    }));
    toast.success(`Loaded credentials for ${roleItem.label}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (mode === 'register') {
      if (!formData.name.trim()) {
        toast.error('Please enter your full name');
        return;
      }
      if (formData.password.length < 6) {
        toast.error('Password must be at least 6 characters long');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        toast.error('Passwords do not match');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await login({
          email: formData.email,
          password: formData.password,
        });
        toast.success('Welcome back! Signed in successfully.');
        navigate('/');
      } else {
        await register({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          phone: formData.phone,
        });
        toast.success('Account created and signed in successfully!');
        navigate('/');
      }
    } catch (err) {
      const msg = getApiErrorMessage(
        err,
        mode === 'login' ? 'Failed to sign in. Please verify your credentials.' : 'Failed to create account.'
      );
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // If user is already logged in, show their active session profile card
  if (isAuthenticated && user) {
    return (
      <div className="mx-auto max-w-2xl py-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-8 text-white">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold backdrop-blur">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-emerald-100 backdrop-blur">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Authenticated
                  </span>
                  <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-white">
                    {user.role}
                  </span>
                </div>
                <h2 className="mt-2 text-2xl font-bold">{user.name}</h2>
                <p className="text-sm text-blue-100">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Account Overview
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <span className="text-xs font-medium text-slate-500">Full Name</span>
                <p className="mt-1 font-semibold text-slate-800">{user.name}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <span className="text-xs font-medium text-slate-500">Email Address</span>
                <p className="mt-1 font-semibold text-slate-800">{user.email}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <span className="text-xs font-medium text-slate-500">Assigned Role</span>
                <p className="mt-1 font-semibold capitalize text-slate-800">{user.role}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <span className="text-xs font-medium text-slate-500">Phone Contact</span>
                <p className="mt-1 font-semibold text-slate-800">{user.phone || 'Not configured'}</p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </button>
                {user.role === 'driver' && (
                  <button
                    type="button"
                    onClick={() => navigate('/driver')}
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
                  >
                    <Truck className="h-4 w-4" />
                    Driver Console
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  toast.success('Signed out successfully');
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl py-4">
      {/* Header Banner */}
      <div className="mb-6 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
          <Shield className="h-6 w-6" />
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Disaster Management Portal
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {mode === 'login'
            ? 'Sign in to access emergency tracking, routes, and alerts.'
            : 'Register your personnel credentials to access the coordination center.'}
        </p>
      </div>

      {/* Main Auth Container */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 p-1.5">
          <button
            type="button"
            onClick={() => handleModeSwitch('login')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
              mode === 'login'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            Sign In (Login)
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('register')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition ${
              mode === 'register'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserPlus className="h-4 w-4" />
            Sign Up (Register)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8">
          {/* Quick Demo Pre-fill helpers */}
          <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/50 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-900">
                Quick-Fill Demo Roles:
              </span>
              <span className="text-[11px] text-blue-600">Click to autofill</span>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleDemoQuickFill(r)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-2xs transition hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-700"
                >
                  <r.icon className="h-3.5 w-3.5" />
                  {r.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {/* Registration-only: Full Name */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative mt-1.5">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Inspector R. Sharma"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            )}

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                Email Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="name@disaster.org"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            {/* Registration-only: Role Selector */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Assigned Personnel Role <span className="text-rose-500">*</span>
                </label>
                <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {ROLES.map((roleItem) => {
                    const isSelected = formData.role === roleItem.id;
                    const Icon = roleItem.icon;
                    return (
                      <button
                        key={roleItem.id}
                        type="button"
                        onClick={() => handleRoleSelect(roleItem.id)}
                        className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg ${
                            isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{roleItem.label}</div>
                          <div className="text-[11px] text-slate-500">{roleItem.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Registration-only: Phone Number */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Contact Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative mt-1.5">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Password <span className="text-rose-500">*</span>
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => toast.info('For demo accounts, password is <role>123 (e.g. operator123)')}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Registration-only: Confirm Password */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative mt-1.5">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    required
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </span>
            ) : (
              <>
                {mode === 'login' ? (
                  <>
                    <KeyRound className="h-4 w-4" />
                    <span>Sign In to Disaster Center</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span>Create Personnel Account</span>
                  </>
                )}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          {/* Footer toggle prompt */}
          <div className="mt-6 text-center text-xs text-slate-500">
            {mode === 'login' ? (
              <p>
                Don't have an emergency operations account?{' '}
                <button
                  type="button"
                  onClick={() => handleModeSwitch('register')}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Create one now
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => handleModeSwitch('login')}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Sign in here
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;
