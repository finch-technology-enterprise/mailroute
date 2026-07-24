const API_BASE = "/api/admin";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("mailroute_token");
  if (token) return { Authorization: `Bearer ${token}` };
  const apiKey = localStorage.getItem("mailroute_api_key");
  if (apiKey) return { "X-API-AUTH-KEY": apiKey };
  return {};
}

export function setToken(token: string): void {
  localStorage.setItem("mailroute_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("mailroute_token");
}

export function hasToken(): boolean {
  return !!localStorage.getItem("mailroute_token");
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  const body = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      if (hasToken()) {
        clearToken();
        window.location.href = "/login";
      } else {
        clearAuthKey();
        window.location.reload();
      }
    }
    throw new Error(body.message || `Request failed (${res.status})`);
  }

  return body;
}

export async function authRequest<T>(method: string, path: string, data?: unknown): Promise<T> {
  const res = await fetch(`/api/auth${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });

  const body = await res.json();

  if (!res.ok) {
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

export function del<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "DELETE",
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
