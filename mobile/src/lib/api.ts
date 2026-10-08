import { config } from './config';
import { supabase } from './supabase';

/**
 * Client for the Lowkei Express API. Every call carries the current
 * Supabase access token; the API verifies it locally and scopes every query
 * to that user.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The request never reached the server, or no answer came back in time. */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

const TIMEOUT_MS = 20_000;

async function accessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new ApiError(401, 'No session', null);
  return data.session.access_token;
}

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const token = await accessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : 'Network request failed');
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    const message =
      parsed && typeof parsed === 'object' && 'message' in parsed && typeof parsed.message === 'string'
        ? parsed.message
        : `Request failed with ${response.status}`;
    throw new ApiError(response.status, message, parsed);
  }

  return parsed as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  delete: <T>(path: string) => request<T>('DELETE', path)
};
