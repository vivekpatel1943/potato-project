import { useState } from "react";

export interface PickedLocation {
  latitude: number;
  longitude: number;
}

interface Props {
  value: PickedLocation | null;
  onChange: (loc: PickedLocation) => void;
  address: string;
  onAddressChange: (address: string) => void;
}

/**
 * "Use current location" + human-readable address.
 * Calls getCurrentPosition directly from the click, which is what makes the
 * browser show its permission prompt.
 */
export default function LocationPicker({ value, onChange, address, onAddressChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = () => {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Your browser doesn't support location.");
      return;
    }
    if (!window.isSecureContext) {
      setError("Location needs a secure connection (HTTPS or localhost).");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location permission was blocked. Allow it from the 🔒 icon in your address bar, then try again.");
        } else if (err.code === err.TIMEOUT) {
          setError("Getting your location timed out. Please try again.");
        } else {
          setError("Couldn't determine your location. Please try again.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  return (
    <div className="space-y-3">
      <div
        className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
          value ? "border-emerald-300 bg-emerald-50/60" : "border-dashed border-border bg-bg"
        }`}
      >
        {/* decorative map grid */}
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(#18181b 1px, transparent 1px), linear-gradient(90deg, #18181b 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="relative flex items-center gap-4 p-4">
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              value ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "bg-primary-ghost text-primary"
            }`}
          >
            {value ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text">{value ? "Location pinned" : "Where is the task?"}</p>
            <p className="text-xs text-text-secondary truncate">
              {value
                ? `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`
                : "We use this to find workers within 10 km."}
            </p>
          </div>
          <button
            id="use-current-location-btn"
            type="button"
            onClick={locate}
            disabled={loading}
            className={`shrink-0 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-60 ${
              value
                ? "text-emerald-700 hover:bg-emerald-100"
                : "bg-primary text-white hover:bg-primary-dark shadow-md shadow-primary/20 active:scale-[0.98]"
            }`}
          >
            {loading ? "Locating…" : value ? "Update" : "Use current location"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-error bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>
      )}

      <input
        id="task-address-input"
        type="text"
        value={address}
        onChange={(e) => onAddressChange(e.target.value)}
        maxLength={500}
        placeholder="Flat / building / landmark (helps the worker find you)"
        className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm text-text placeholder:text-text-secondary/70
          focus:border-primary focus:outline-none transition-colors"
      />
    </div>
  );
}
