import React, { useState } from 'react';

interface StepHomeBaseProps {
  onLocationFound: (lat: number, lng: number) => void;
  onNext: () => void;
  onBack: () => void;
  initialLat?: number;
  initialLng?: number;
}

export const StepHomeBase: React.FC<StepHomeBaseProps> = ({ 
  onLocationFound, 
  onNext, 
  onBack,
  initialLat,
  initialLng
}) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );

  const handleGetLocation = () => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });
        onLocationFound(lat, lng);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        setError('Location access is required to receive tasks. Please enable location permissions in your browser settings.');
      }
    );
  };

  return (
    <div className="flex flex-col space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Set Your Home Base</h2>
        <p className="text-gray-600">
          Tasks are matched based on your location. We need to know where your primary operating base is to send you nearby opportunities.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 p-6 rounded-xl flex flex-col items-center justify-center space-y-4">
        {coords ? (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="font-medium text-green-800 text-lg">Location Captured!</h3>
            <p className="text-green-600/80 text-sm mt-1">
              Lat: {coords.lat.toFixed(4)}, Lng: {coords.lng.toFixed(4)}
            </p>
            <button 
              onClick={handleGetLocation}
              disabled={loading}
              className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium underline"
            >
              {loading ? 'Locating...' : 'Update Location'}
            </button>
          </div>
        ) : (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <button 
              onClick={handleGetLocation}
              disabled={loading}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm"
            >
              {loading ? 'Finding you...' : 'Use Current Location'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex gap-3 text-sm border border-red-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p>{error}</p>
        </div>
      )}

      <div className="flex justify-between pt-6 border-t border-gray-200">
        <button
          onClick={onBack}
          className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!coords}
          className="px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-black transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next Step
        </button>
      </div>
    </div>
  );
};
