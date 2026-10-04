export function readJsonResponse(response: Response, label?: string): Promise<any>;
export function fetchJson(
  url: string | Response,
  options?: { signal?: AbortSignal; label?: string; fetcher?: typeof fetch }
): Promise<any>;
