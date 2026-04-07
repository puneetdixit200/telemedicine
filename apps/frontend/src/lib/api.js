export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const requestOptions = {
    method: options.method || 'GET',
    credentials: 'include',
    headers
  };

  if (options.body instanceof FormData) {
    requestOptions.body = options.body;
  } else if (options.body !== undefined) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    requestOptions.body = JSON.stringify(options.body);
  }

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const res = await fetch(path, requestOptions);
  const contentType = res.headers.get('content-type') || '';

  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return {
    ok: res.ok,
    status: res.status,
    data,
    headers: res.headers
  };
}

export function utcDateTime(value) {
  if (!value) return 'N/A';
  try {
    return new Date(value).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  } catch (_err) {
    return String(value);
  }
}
