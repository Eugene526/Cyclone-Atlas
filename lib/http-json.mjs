function isHtmlResponse(response, body) {
  const type = response.headers.get('content-type') || '';
  return /text\/html/i.test(type) || /^\s*<!doctype\s+html|^\s*<html\b/i.test(body);
}

/** Read a JSON API response without leaking a browser JSON.parse error when an
 * edge/router returns its HTML error document instead of the API payload. */
export async function readJsonResponse(response, label = '資料服務') {
  const body = await response.text();
  let value;
  try {
    value = JSON.parse(body);
  } catch {
    const html = isHtmlResponse(response, body);
    const status = response.status ? `（HTTP ${response.status}）` : '';
    throw new Error(`${label}暫時回傳${html ? '錯誤網頁' : '非 JSON 資料'}${status}，請稍後重試。`);
  }
  if (!response.ok) throw new Error(value?.error || `${label}讀取失敗（HTTP ${response.status}）`);
  return value;
}

/** Retry once for transient edge HTML (e.g. an upstream gateway document). */
export async function fetchJson(url, { signal, label = '資料服務', fetcher = fetch } = {}) {
  let lastError;
  const suppliedResponse = url instanceof Response ? url : null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = attempt === 0 && suppliedResponse
      ? suppliedResponse
      : await fetcher(url instanceof Response ? url.url : url, { signal, cache: 'no-store' });
    try {
      return await readJsonResponse(response, label);
    } catch (error) {
      lastError = error;
      if (attempt || !/回傳(?:錯誤網頁|非 JSON 資料)/.test(error?.message || '')) throw error;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 250);
        const abort = () => { clearTimeout(timer); reject(new DOMException('讀取已取消', 'AbortError')); };
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
      });
    }
  }
  throw lastError;
}
