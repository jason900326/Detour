import { DETOUR_API_CONFIG } from './app-config';

type AccessTokenProvider = () => string | null | Promise<string | null>;

export class DetourApiError extends Error {
  readonly status: number;
  readonly endpoint: string;
  readonly requestId: string;

  constructor(args: {
    status: number;
    endpoint: string;
    requestId: string;
    message: string;
  }) {
    super(args.message);
    this.name = 'DetourApiError';
    this.status = args.status;
    this.endpoint = args.endpoint;
    this.requestId = args.requestId;
  }
}

let accessTokenProvider: AccessTokenProvider | null = null;

/**
 * Authentication is intentionally injected instead of imported here. The
 * current app is anonymous, while the next auth layer can register a session
 * token without every engine learning how Supabase sessions work.
 */
export function setApiAccessTokenProvider(
  provider: AccessTokenProvider | null
) {
  accessTokenProvider = provider;
}

function requestId() {
  return `dtr-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function endpointLabel(endpoint: string) {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}

export async function fetchDetourApi(
  endpoint: string,
  init: RequestInit = {},
  timeoutMs = 8000
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const id = requestId();
  const headers = new Headers(init.headers);

  headers.set('Accept', 'application/json');
  headers.set('apikey', DETOUR_API_CONFIG.supabasePublishableKey);
  headers.set('x-detour-request-id', id);

  try {
    const accessToken = await accessTokenProvider?.();
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

    const response = await fetch(endpoint, {
      ...init,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new DetourApiError({
        status: response.status,
        endpoint: endpointLabel(endpoint),
        requestId: id,
        message: `Detour API ${response.status}: ${body.slice(0, 240)}`,
      });
    }

    return response;
  } catch (error) {
    if (controller.signal.aborted && !(error instanceof DetourApiError)) {
      throw new DetourApiError({
        status: 408,
        endpoint: endpointLabel(endpoint),
        requestId: id,
        message: 'Detour API request timed out.',
      });
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function postDetourJson<T>(
  endpoint: string,
  payload: unknown,
  timeoutMs = 8000
): Promise<T> {
  const response = await fetchDetourApi(
    endpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    timeoutMs
  );

  const raw = await response.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new DetourApiError({
      status: 502,
      endpoint: endpointLabel(endpoint),
      requestId: 'response',
      message: 'Detour API returned invalid JSON.',
    });
  }
}
