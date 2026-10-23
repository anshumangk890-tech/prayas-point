export async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...options, headers: { ...(options?.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...options?.headers } });
  } catch { throw new Error("You seem to be offline. Check your connection and try again."); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Something went wrong. Please try again.");
  return payload as T;
}
export function postJson<T>(url: string, body: unknown): Promise<T> {
  return apiRequest<T>(url, { method: "POST", body: JSON.stringify(body) });
}
