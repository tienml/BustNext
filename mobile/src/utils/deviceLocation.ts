import type { LocationObject, LocationSubscription } from 'expo-location';

export const CACHE_MAX_AGE_MS = 5 * 60_000;
export const CACHE_MAX_ACCURACY_M = 1000;

export function isUsableLocation(location: LocationObject, now = Date.now(), maxAge = CACHE_MAX_AGE_MS): boolean {
  const { latitude, longitude, accuracy } = location.coords;
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && Number.isFinite(longitude) && Math.abs(longitude) <= 180
    && Number.isFinite(location.timestamp) && location.timestamp <= now + 5000
    && now - location.timestamp <= maxAge
    && accuracy !== null && Number.isFinite(accuracy) && accuracy >= 0
    && accuracy <= CACHE_MAX_ACCURACY_M;
}

export function describeLocation(location: LocationObject, cached: boolean): string {
  const time = new Date(location.timestamp).toLocaleTimeString('vi-VN');
  const accuracy = location.coords.accuracy;
  return `${cached ? 'Vị trí đã lưu trên thiết bị' : 'Vị trí thiết bị'} lúc ${time} · ${accuracy == null ? 'chưa rõ độ chính xác' : `sai số ước tính ${Math.ceil(accuracy)} m`}.`;
}

type StartWatch = (
  onLocation: (location: LocationObject) => void,
  onError: (error: unknown) => void,
) => Promise<LocationSubscription>;

/** One foreground fix; even a subscription that arrives after cancellation is removed. */
export function acquireLocation(startWatch: StartWatch, signal: AbortSignal, timeoutMs = 30_000): Promise<LocationObject> {
  return new Promise((resolve, reject) => {
    let subscription: LocationSubscription | undefined;
    let settled = false;
    const finish = (location?: LocationObject, error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      subscription?.remove();
      if (location) resolve(location);
      else reject(error);
    };
    const abort = () => finish(undefined, new Error('location_cancelled'));
    const timer = setTimeout(() => finish(undefined, new Error('location_timeout')), timeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    // A watch may callback before its setup promise resolves.
    Promise.resolve().then(() => {
      if (settled) return;
      return startWatch(
        (location) => {
          if (isUsableLocation(location, Date.now(), 60_000)) finish(location);
        },
        (error) => finish(undefined, error),
      );
    }).then((watch) => {
      if (!watch) return;
      subscription = watch;
      if (settled) watch.remove();
    }, (error) => finish(undefined, error));
  });
}
