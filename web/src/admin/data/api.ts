/* Thin typed wrapper around the real FastAPI backend.
 *
 * Ported line by line from `legacy/admin/assets/js/api.js`. Every call goes to
 * the real backend; callers surface failures instead of substituting rows.
 *
 * Two small robustness additions over the legacy file, both invisible in the
 * browser: `localStorage` and `location` are accessed defensively so the
 * module can be imported during the site prerender or in unit tests.
 */

import type {
  AdminUser,
  Alert,
  Device,
  Order,
  OrderPatch,
  Plant,
  PlantInput,
  Product,
  ProductInput,
  Reading,
  User,
} from "./types";

const TOKEN_KEY = "fg_admin_token";
const BASE_KEY = "fg_api_base";

export const DEFAULT_API_BASE = "http://localhost:8000";

/* `localStorage` is missing in Node (tests, prerender); fall back to memory. */
const memoryStore = new Map<string, string>();

const storage = {
  get(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? memoryStore.get(key) ?? null;
    } catch {
      return memoryStore.get(key) ?? null;
    }
  },
  set(key: string, value: string): void {
    memoryStore.set(key, value);
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* private mode / quota — the in-memory copy still works for this session */
    }
  },
  remove(key: string): void {
    memoryStore.delete(key);
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export function apiBase(): string {
  let fromUrl: string | null = null;
  try {
    fromUrl = new URLSearchParams(globalThis.location?.search ?? "").get("api");
  } catch {
    fromUrl = null;
  }
  return (fromUrl || storage.get(BASE_KEY) || DEFAULT_API_BASE).replace(/\/+$/, "");
}

export function setApiBase(value: string): void {
  if (value) storage.set(BASE_KEY, value.replace(/\/+$/, ""));
  else storage.remove(BASE_KEY);
}

export function getToken(): string {
  return storage.get(TOKEN_KEY) || "";
}

export function setToken(token: string): void {
  if (token) storage.set(TOKEN_KEY, token);
  else storage.remove(TOKEN_KEY);
}

/* The backend stores plant photos as server-relative paths
   (`/static/plants/绿萝.jpg`). In development the console and the API live on
   different origins, so those paths must be resolved against `apiBase()`.
   Everything else — bundled `/assets/…` paths and remote https URLs — passes
   through untouched. */
export function mediaUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/static/")) return apiBase() + value;
  return value;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  form?: Record<string, string>;
  auth?: boolean;
  timeout?: number;
};

async function request<T>(path: string, { method = "GET", body, form, auth = true, timeout = 12000 }: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const headers: Record<string, string> = {};
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let payload: string | undefined;
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  try {
    const res = await fetch(apiBase() + path, {
      method,
      headers,
      body: payload,
      signal: controller.signal,
    });
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok) {
      const detail =
        data && typeof data === "object" ? (data as { detail?: unknown }).detail : data;
      throw new ApiError(
        Array.isArray(detail)
          ? detail.map((d) => (d as { msg?: string }).msg).join("；")
          : (detail as string) || `请求失败（${res.status}）`,
        res.status,
      );
    }
    return data as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("请求超时，请检查后端是否启动", 0);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function login(username: string, password: string): Promise<{ access_token: string }> {
  const token = await request<{ access_token: string }>("/api/users/login", {
    method: "POST",
    form: { username, password },
    auth: false,
  });
  if (!token || !token.access_token) throw new ApiError("登录响应缺少 access_token", 0);
  setToken(token.access_token);
  return token;
}

/* The backend may answer a list endpoint with a bare array or with a paged
   `{ items }` envelope; the legacy loader tolerated both, so the types do too. */
export type ListResult<T> = { items: T[] } | T[];

export const api = {
  me: (): Promise<AdminUser> => request<AdminUser>("/api/users/me"),
  products: (limit = 100): Promise<{ items: Product[] }> =>
    request<{ items: Product[] }>(`/api/admin/products?limit=${limit}`),
  createProduct: (body: ProductInput): Promise<Product> =>
    request<Product>("/api/admin/products", { method: "POST", body }),
  updateProduct: (id: number, body: Partial<ProductInput>): Promise<Product> =>
    request<Product>(`/api/admin/products/${id}`, { method: "PUT", body }),
  deleteProduct: (id: number): Promise<null> =>
    request<null>(`/api/admin/products/${id}`, { method: "DELETE" }),
  orders: (limit = 100): Promise<{ items: Order[] }> =>
    request<{ items: Order[] }>(`/api/admin/orders?limit=${limit}`),
  updateOrder: (id: number, body: OrderPatch): Promise<Order> =>
    request<Order>(`/api/admin/orders/${id}`, { method: "PUT", body }),
  users: (limit = 100): Promise<{ items: User[] }> =>
    request<{ items: User[] }>(`/api/admin/users?limit=${limit}`),
  plants: (limit = 100): Promise<{ items: Plant[] }> =>
    request<{ items: Plant[] }>(`/api/admin/plants?limit=${limit}`),
  createPlant: (body: PlantInput): Promise<Plant> =>
    request<Plant>("/api/admin/plants", { method: "POST", body }),
  updatePlant: (id: number, body: Partial<PlantInput>): Promise<Plant> =>
    request<Plant>(`/api/admin/plants/${id}`, { method: "PUT", body }),
  deletePlant: (id: number): Promise<null> =>
    request<null>(`/api/admin/plants/${id}`, { method: "DELETE" }),
  statsOverview: (): Promise<unknown> => request<unknown>("/api/admin/stats/overview"),
  statsTrend: (groupBy: "day" | "week" = "day"): Promise<unknown> =>
    request<unknown>(`/api/admin/stats/trend?group_by=${groupBy}`),
  statsProducts: (limit = 10): Promise<unknown> =>
    request<unknown>(`/api/admin/stats/products?limit=${limit}`),
  devices: (): Promise<ListResult<Device>> => request<ListResult<Device>>("/api/admin/devices"),
  createDevice: (body: { code: string; name: string; location: string }): Promise<Device> =>
    request<Device>("/api/admin/devices", { method: "POST", body }),
  device: (code: string): Promise<Device> =>
    request<Device>(`/api/admin/devices/${encodeURIComponent(code)}`),
  updateDevice: (code: string, body: Partial<Device>): Promise<Device> =>
    request<Device>(`/api/admin/devices/${encodeURIComponent(code)}`, { method: "PUT", body }),
  deviceReadings: (code: string, hours = 24): Promise<{ items: Reading[] }> =>
    request<{ items: Reading[] }>(
      `/api/admin/devices/${encodeURIComponent(code)}/readings?hours=${hours}`,
    ),
  deviceAlerts: (): Promise<ListResult<Alert>> =>
    request<ListResult<Alert>>("/api/admin/device-alerts"),
  acknowledgeAlert: (id: number): Promise<Alert> =>
    request<Alert>(`/api/admin/device-alerts/${id}/ack`, { method: "PUT" }),
  sensorsOverview: (): Promise<unknown> => request<unknown>("/api/admin/devices/overview"),
};
