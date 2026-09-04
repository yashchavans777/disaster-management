import { useState } from 'react';
import { AlertTriangle, LoaderCircle, MapPin, X } from 'lucide-react';

const incidentTypeOptions = [
  { label: 'Landslide', value: 'landslide' },
  { label: 'Flood', value: 'flood' },
  { label: 'Roadblock', value: 'roadblock' },
];

const initialFormState = {
  type: 'landslide',
  description: '',
  latitude: '',
  longitude: '',
};

function ReportIncidentModal({
  isOpen,
  isSubmitting = false,
  onClose,
  onSubmit,
}) {
  const [formValues, setFormValues] = useState(initialFormState);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((currentValues) => ({
      ...currentValues,
      [name]: value,
    }));
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported in this browser.');
      return;
    }

    setIsFetchingLocation(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormValues((currentValues) => ({
          ...currentValues,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setIsFetchingLocation(false);
      },
      (error) => {
        setLocationError(
          error.message || 'Unable to retrieve your current location.'
        );
        setIsFetchingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();

    await onSubmit({
      type: formValues.type,
      description: formValues.description.trim(),
      latitude: Number(formValues.latitude),
      longitude: Number(formValues.longitude),
    });

    setFormValues(initialFormState);
    setLocationError('');
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Report Incident
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Submit a field incident with type, description, and GPS
              coordinates.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close incident report modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="space-y-5 px-6 py-5" onSubmit={handleFormSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Type</span>
            <select
              name="type"
              value={formValues.type}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {incidentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">
              Description
            </span>
            <textarea
              name="description"
              value={formValues.description}
              onChange={handleChange}
              rows={4}
              required
              placeholder="Describe the incident and the impact on the route..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Latitude
              </span>
              <input
                type="number"
                step="any"
                name="latitude"
                value={formValues.latitude}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Longitude
              </span>
              <input
                type="number"
                step="any"
                name="longitude"
                value={formValues.longitude}
                onChange={handleChange}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={handleGetCurrentLocation}
              disabled={isFetchingLocation}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isFetchingLocation ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              {isFetchingLocation
                ? 'Fetching location...'
                : 'Get Current Location'}
            </button>

            {locationError ? (
              <p className="text-sm text-red-600">{locationError}</p>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSubmitting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {isSubmitting ? 'Submitting...' : 'Submit Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReportIncidentModal;
