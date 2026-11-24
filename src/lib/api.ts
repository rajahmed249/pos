let apiAuthToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setApiAuthToken(token: string | null): void {
  apiAuthToken = token;
}

export function getApiAuthToken(): string | null {
  return apiAuthToken;
}

export function setOnUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

function buildHeaders(extra?: HeadersInit): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (extra) {
    if (extra instanceof Headers) {
      extra.forEach((v, k) => {
        headers[k] = v;
      });
    } else if (Array.isArray(extra)) {
      for (const [k, v] of extra) {
        headers[k] = v;
      }
    } else {
      Object.assign(headers, extra);
    }
  }
  if (apiAuthToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${apiAuthToken}`;
  }
  return headers;
}

const PUBLIC_AUTH_URLS = new Set([
  '/api/auth/login',
  '/api/auth/request-recovery-code',
  '/api/auth/recover-password',
  '/api/auth/session',
  '/api/auth/logout',
]);

async function readJsonSafely<T>(res: Response): Promise<{ ok: boolean; data: T | null; isHtml: boolean; htmlTitle: string; rawText: string }> {
  const rawText = await res.text();
  const trimmed = rawText.trim();
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const isHtml =
    contentType.includes('text/html') ||
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html');

  if (isHtml) {
    const titleMatch = trimmed.match(/<title[^>]*>([^<]{1,80})<\/title>/i);
    const htmlTitle = titleMatch ? titleMatch[1].trim() : '';
    return { ok: false, data: null, isHtml: true, htmlTitle, rawText: trimmed };
  }
  if (!trimmed) {
    return { ok: true, data: {} as T, isHtml: false, htmlTitle: '', rawText: '' };
  }
  try {
    return { ok: true, data: JSON.parse(trimmed) as T, isHtml: false, htmlTitle: '', rawText: trimmed };
  } catch {
    return { ok: false, data: null, isHtml: false, htmlTitle: '', rawText: trimmed };
  }
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const attempt = async () =>
    fetch(url, {
      ...options,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: buildHeaders(options?.headers),
    });

  let res = await attempt();
  let parsed = await readJsonSafely<T & { error?: string }>(res);

  // If preview proxy/dev-server is restarting ("Starting Server..."), retry across boot window
  const isBootingHtml =
    parsed.isHtml &&
    (!res.redirected || /starting server/i.test(parsed.htmlTitle) || res.status >= 502);

  if (isBootingHtml) {
    for (const delayMs of [1500, 2000, 2500, 3000, 3500, 3500]) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      res = await attempt();
      parsed = await readJsonSafely<T & { error?: string }>(res);
      if (!parsed.isHtml) break;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && !PUBLIC_AUTH_URLS.has(url.split('?')[0])) {
      unauthorizedHandler?.();
    }
    const message =
      (parsed.data && typeof parsed.data.error === 'string' && parsed.data.error) ||
      (parsed.isHtml
        ? `Server is restarting or unavailable (HTTP ${res.status}${parsed.htmlTitle ? `: ${parsed.htmlTitle}` : ''}). Please wait a moment and try again.`
        : `HTTP ${res.status}`);
    throw new Error(message);
  }

  if (parsed.isHtml || !parsed.ok || parsed.data === null) {
    throw new Error(
      parsed.isHtml
        ? `Preview session or server returned an HTML page instead of API JSON (HTTP ${res.status}${parsed.htmlTitle ? ` — ${parsed.htmlTitle}` : ''}). Please refresh the browser page and try again.`
        : 'Invalid server response received.'
    );
  }

  return parsed.data as T;
}

export async function apiDownload(url: string, fallbackFilename: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (apiAuthToken) {
    headers.Authorization = `Bearer ${apiAuthToken}`;
  }
  const res = await fetch(url, {
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!res.ok) {
    if (res.status === 401) {
      unauthorizedHandler?.();
    }
    const err = await res.json().catch(() => ({ error: 'Download failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('text/html')) {
    throw new Error('Server is restarting or returned an HTML page instead of the download file. Please try again.');
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackFilename;
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}

export function formatMoney(amount: unknown, currency = '৳'): string {
  const num = Number(amount ?? 0);
  return `${currency}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>): void {
  const escape = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
