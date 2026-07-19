const API_BASE = "/email/api/admin";

function getAuthKey(): string {
  return localStorage.getItem("mailroute_api_key") || "";
}

export function setAuthKey(key: string): void {
  localStorage.setItem("mailroute_api_key", key);
}

export function clearAuthKey(): void {
  localStorage.removeItem("mailroute_api_key");
}

export function hasAuthKey(): boolean {
  return !!localStorage.getItem("mailroute_api_key");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-AUTH-KEY": getAuthKey(),
      ...options.headers,
    },
  });

  const body = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      clearAuthKey();
      window.location.reload();
    }
    throw new Error(body.message || `Request failed (${res.status})`);
  }

  return body;
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function post<T>(path: string, data: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function put<T>(path: string, data: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}
