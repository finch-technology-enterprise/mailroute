const API_BASE = "/api/admin";

function getAuthHeaders(): Record<string, string> {
  const apiKey = localStorage.getItem("mailroute_api_key");
  if (apiKey) return { "X-API-AUTH-KEY": apiKey };
  return {};
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

export async function checkAuth(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
    });
    const body = await res.json();
    return body.success === true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  const body = await res.json();

  if (!res.ok) {
    if (res.status === 401) {
      if (hasAuthKey()) {
        clearAuthKey();
        window.location.reload();
      } else {
        const refreshed = await refreshToken();
        if (refreshed) {
          return request(path, options);
        }
        window.location.href = "/login";
      }
    }
    throw new Error(body.message || `Request failed (${res.status})`);
  }

  return body;
}

export async function authRequest<T>(method: string, path: string, data?: unknown): Promise<T> {
  const res = await fetch(`/api/auth${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
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
