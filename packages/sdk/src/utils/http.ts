import type { CompliiError } from '../types';

export interface HttpClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
}

export class CompliiApiError extends Error {
  public readonly type: string;
  public readonly code: string;
  public readonly param?: string;
  public readonly requestId?: string;
  public readonly statusCode: number;

  constructor(error: CompliiError, statusCode: number) {
    super(error.message);
    this.name = 'CompliiApiError';
    this.type = error.type;
    this.code = error.code;
    this.param = error.param;
    this.requestId = error.requestId;
    this.statusCode = statusCode;
  }
}

export class HttpClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;

  constructor(config: HttpClientConfig) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout;
  }

  async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string | number | boolean | undefined>;
    }
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);

    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new CompliiApiError(data.error, response.status);
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof CompliiApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    }
  }

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return this.request<T>('GET', path, { params });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, { body });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PATCH', path, { body });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  async postFormData<T>(path: string, formData: FormData): Promise<T> {
    const url = new URL(path, this.baseUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          // Note: Don't set Content-Type for FormData - browser will set it with boundary
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        throw new CompliiApiError(data.error, response.status);
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof CompliiApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    }
  }
}
