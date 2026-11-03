// The device id binds an attempt to one device under the "standard" security profile.
// It survives logouts on purpose: it identifies the computer, not the user.
const KEY = 'doexam.device_id';

let cached: string | null = null;

export function deviceId(): string {
  if (cached) return cached;
  try {
    cached = localStorage.getItem(KEY);
    if (!cached) {
      cached = crypto.randomUUID();
      localStorage.setItem(KEY, cached);
    }
  } catch {
    cached ??= crypto.randomUUID();
  }
  return cached;
}
