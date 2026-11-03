// HTTP client for the DoExam API: adds the bearer token, unwraps the response envelope
// ({success, message, data, errors, meta, trace_id}) and throws ApiError on failure.

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string> = {},
    public traceId?: string,
  ) {
    super(message);
  }
  get isNetwork() {
    return this.status === 0;
  }
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface Config {
  tokenKey: string;
  onUnauthorized: () => void;
  headers?: () => Record<string, string>;
}

let config: Config = { tokenKey: 'doexam.token', onUnauthorized: () => {} };

/** configureApi is called once per entry: exam and panel keep separate tokens. */
export function configureApi(c: Config) {
  config = c;
}

export const tokenStore = {
  get: () => safeGet(config.tokenKey),
  set: (t: string) => safeSet(config.tokenKey, t),
  clear: () => safeSet(config.tokenKey, null),
};

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch {
    /* private mode: the session lives until reload */
  }
}

export function buildQuery(q?: Query): string {
  if (!q) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function request(method: string, path: string, body?: unknown, query?: Query): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', ...(config.headers?.() ?? {}) };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}${buildQuery(query)}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'network error');
  }
  if (res.ok) return res;

  let env: { message?: string; errors?: Record<string, string>; trace_id?: string } = {};
  try {
    env = await res.json();
  } catch {
    /* non-JSON error (proxy, gateway) */
  }
  if (res.status === 401 && token && !path.startsWith('/auth/login')) {
    tokenStore.clear();
    config.onUnauthorized();
  }
  throw new ApiError(res.status, env.message ?? res.statusText, env.errors ?? {}, env.trace_id);
}

async function json<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const res = await request(method, path, body, query);
  const env = await res.json();
  return env.data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => json<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown, query?: Query) => json<T>('POST', path, body ?? {}, query),
  patch: <T>(path: string, body: unknown) => json<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => json<T>('PUT', path, body),
  del: <T = null>(path: string) => json<T>('DELETE', path),

  /** page reads a paginated list (meta: total, page, per_page). */
  async page<T>(path: string, query?: Query): Promise<Page<T>> {
    const res = await request('GET', path, undefined, query);
    const env = await res.json();
    return {
      items: (env.data ?? []) as T[],
      total: env.meta?.total ?? 0,
      page: env.meta?.page ?? 1,
      perPage: env.meta?.per_page ?? 20,
    };
  },

  /** download fetches a file response (xlsx exports, credentials) and saves it. */
  async download(path: string, fallbackName: string, query?: Query) {
    const res = await request('GET', path, undefined, query);
    const blob = await res.blob();
    const cd = res.headers.get('Content-Disposition') ?? '';
    const name = /filename="?([^"]+)"?/.exec(cd)?.[1] ?? fallbackName;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
