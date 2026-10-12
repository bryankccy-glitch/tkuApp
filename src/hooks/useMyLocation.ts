import { useCallback, useEffect, useRef, useState } from 'react';

export interface MyLocation {
  lat: number;
  lng: number;
  /** Radius of the 68% confidence circle, metres. */
  accuracy: number;
}
export type LocationError = 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'insecure';

/**
 * Asks for the device position only when `start()` is called (never on page load), then keeps
 * following it until `stop()` or unmount. The position never leaves the device.
 */
export function useMyLocation() {
  const [location, setLocation] = useState<MyLocation | null>(null);
  const [error, setError] = useState<LocationError | null>(null);
  const [locating, setLocating] = useState(false);
  const watchId = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setLocating(false);
  }, []);

  const start = useCallback(() => {
    setError(null);
    if (typeof window !== 'undefined' && window.isSecureContext === false) return setError('insecure');
    if (!('geolocation' in navigator)) return setError('unsupported');
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    setLocating(true);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setError(err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable');
        if (err.code === err.PERMISSION_DENIED && watchId.current !== null) {
          navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
        }
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 10_000 },
    );
  }, []);

  useEffect(() => stop, [stop]);
  return { location, error, locating, start, stop };
}

/** Great-circle distance in metres. */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
