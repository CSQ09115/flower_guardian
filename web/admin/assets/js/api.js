/* Thin fetch wrapper around the real FastAPI backend.
   The console stays usable without the backend: callers fall back to demo data. */

const TOKEN_KEY = "fg_admin_token";
const BASE_KEY = "fg_api_base";

export const DEFAULT_API_BASE = "http://localhost:8000";

export function apiBase() {
  const fromUrl = new URLSearchParams(location.search).get("api");
  return (fromUrl || localStorage.getItem(BASE_KEY) || DEFAULT_API_BASE).replace(/\/+$/, "");
}

export function setApiBase(value) {
  if (value) localStorage.setItem(BASE_KEY, value.replace(/\/+$/, ""));
  else localStorage.removeItem(BASE_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, { method = "GET", body, form, auth = true, timeout = 12000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const headers = {};
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let payload;
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
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { data = text; }
    }
    if (!res.ok) {
      const detail = data && typeof data === "object" ? data.detail : data;
      throw new ApiError(Array.isArray(detail) ? detail.map((d) => d.msg).join("；") : detail || `请求失败（${res.status}）`, res.status);
    }
    return data;
  } catch (err) {
    if (err.name === "AbortError") throw new ApiError("请求超时，请检查后端是否启动", 0);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function login(username, password) {
  const token = await request("/api/users/login", {
    method: "POST",
    form: { username, password },
    auth: false,
  });
  if (!token || !token.access_token) throw new ApiError("登录响应缺少 access_token", 0);
  setToken(token.access_token);
  return token;
}

export const api = {
  me: () => request("/api/users/me"),
  products: (limit = 100) => request(`/api/admin/products?limit=${limit}`),
  createProduct: (body) => request("/api/admin/products", { method: "POST", body }),
  updateProduct: (id, body) => request(`/api/admin/products/${id}`, { method: "PUT", body }),
  deleteProduct: (id) => request(`/api/admin/products/${id}`, { method: "DELETE" }),
  orders: (limit = 100) => request(`/api/admin/orders?limit=${limit}`),
  updateOrder: (id, body) => request(`/api/admin/orders/${id}`, { method: "PUT", body }),
  users: (limit = 100) => request(`/api/admin/users?limit=${limit}`),
  plants: (limit = 100) => request(`/api/admin/plants?limit=${limit}`),
  createPlant: (body) => request("/api/admin/plants", { method: "POST", body }),
  updatePlant: (id, body) => request(`/api/admin/plants/${id}`, { method: "PUT", body }),
  deletePlant: (id) => request(`/api/admin/plants/${id}`, { method: "DELETE" }),
  statsOverview: () => request("/api/admin/stats/overview"),
  statsTrend: (groupBy = "day") => request(`/api/admin/stats/trend?group_by=${groupBy}`),
  statsProducts: (limit = 10) => request(`/api/admin/stats/products?limit=${limit}`),
  devices: () => request("/api/admin/devices"),
  createDevice: (body) => request("/api/admin/devices", { method: "POST", body }),
  device: (code) => request(`/api/admin/devices/${encodeURIComponent(code)}`),
  updateDevice: (code, body) => request(`/api/admin/devices/${encodeURIComponent(code)}`, { method: "PUT", body }),
  deviceReadings: (code, hours = 24) => request(`/api/admin/devices/${encodeURIComponent(code)}/readings?hours=${hours}`),
  deviceAlerts: () => request("/api/admin/device-alerts"),
  acknowledgeAlert: (id) => request(`/api/admin/device-alerts/${id}/ack`, { method: "PUT" }),
  sensorsOverview: () => request("/api/admin/devices/overview"),
};
