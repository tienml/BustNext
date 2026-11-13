import { Platform } from 'react-native';

export type JsonResponse = Pick<Response, 'status' | 'ok' | 'json'>;

type RequestOptions = {
  method: string;
  headers: Record<string, string>;
  body?: string | FormData;
  signal: AbortSignal;
};

function abortError() {
  const error = new Error('Request cancelled');
  error.name = 'AbortError';
  return error;
}

/** API-only transport; does not replace global fetch or construct a Response. */
export function requestJson(url: string, options: RequestOptions): Promise<JsonResponse> {
  if (Platform.OS === 'web') return fetch(url, options);

  // RN 0.76 uses whatwg-fetch: its asynchronous onload constructs Response(0)
  // outside the fetch Promise's executor. A caller's catch cannot catch that throw.
  return new Promise((resolve, reject) => {
    if (options.signal.aborted) {
      reject(abortError());
      return;
    }
    const xhr = new XMLHttpRequest();
    let settled = false;
    const cleanup = () => {
      options.signal.removeEventListener('abort', cancel);
      xhr.onload = xhr.onerror = xhr.ontimeout = xhr.onabort = null;
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const cancel = () => {
      // Reject before abort, even if the native implementation emits no event.
      fail(abortError());
      xhr.abort();
    };
    xhr.onload = () => {
      if (settled) return;
      const status = xhr.status;
      if (status < 200 || status > 599) {
        fail(new TypeError('Network request failed'));
        return;
      }
      const text = xhr.responseText;
      settled = true;
      cleanup();
      resolve({ status, ok: status >= 200 && status < 300, json: async () => JSON.parse(text) });
    };
    xhr.onerror = () => fail(new TypeError('Network request failed'));
    xhr.ontimeout = () => fail(new TypeError('Network request timed out'));
    xhr.onabort = () => fail(abortError());
    options.signal.addEventListener('abort', cancel);
    try {
      xhr.open(options.method, url, true);
      for (const [name, value] of Object.entries(options.headers)) xhr.setRequestHeader(name, value);
      // Let native XHR generate multipart boundaries for FormData uploads.
      xhr.send(options.body ?? null);
    } catch (cause) {
      fail(cause instanceof Error ? cause : new TypeError('Network request failed'));
    }
  });
}
