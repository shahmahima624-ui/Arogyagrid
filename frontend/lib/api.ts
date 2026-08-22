export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

// ─── Typed API Error ────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  detail?: string;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

// ─── Token Helpers ──────────────────────────────────────────────────────────

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("aarogya_token");
}

export function setAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem("aarogya_token", token);
  } else {
    localStorage.removeItem("aarogya_token");
  }
}

// ─── Core API Function ──────────────────────────────────────────────────────

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const detail = errorBody?.detail ?? `Request failed with status ${response.status}`;

    if (response.status === 401) {
      // Token invalid/expired — clear stored token and redirect to login
      setAuthToken(null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("aarogya:auth-expired"));
        window.location.replace("/login");
      }
    }

    if (response.status === 403) {
      if (typeof window !== "undefined") {
        window.location.replace("/forbidden");
      }
    }

    throw new ApiError(detail, response.status, detail);
  }

  return response.json() as Promise<T>;
}
