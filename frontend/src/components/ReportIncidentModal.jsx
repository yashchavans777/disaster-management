import { useState } from 'react';
import { AlertTriangle, Camera, Image, LoaderCircle, MapPin, Upload, X } from 'lucide-react';

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
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
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

  const handlePhotoSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setSelectedPhoto(null);
    setPhotoPreview(null);
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();

    await onSubmit({
      type: formValues.type,
      description: formValues.description.trim(),
      latitude: Number(formValues.latitude),
      longitude: Number(formValues.longitude),
      photo: photoPreview || selectedPhoto,
      photoName: selectedPhoto?.name,
    });

    setFormValues(initialFormState);
    setSelectedPhoto(null);
    setPhotoPreview(null);
    setLocationError('');
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/50 px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Report New Incident
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

          {/* Task 3: Incident Photo Upload with Local Thumbnail Preview */}
          <div className="space-y-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="incident-photo-input"
                className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700 hover:text-indigo-600"
              >
                <Camera className="h-4 w-4 text-indigo-500" />
                <span>Attach Geo-Tagged Field Photo</span>
              </label>
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Optional
              </span>
            </div>

            <input
              id="incident-photo-input"
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />

            {/* Thumbnail Preview immediately rendered after selection */}
            {photoPreview && (
              <div className="mt-2.5 flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2 shadow-2xs">
                <img
                  src={photoPreview}
                  alt="Incident Thumbnail Preview"
                  className="h-14 w-14 rounded-md object-cover border border-slate-200 shadow-xs shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800">
                    {selectedPhoto?.name || 'field_evidence.jpg'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {selectedPhoto
                      ? `${(selectedPhoto.size / 1024).toFixed(1)} KB`
                      : 'Photo attached'}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                    📸 Geo-tagged & ready for verification
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600 transition"
                  aria-label="Remove attached photo"
                  title="Remove photo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
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
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
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
