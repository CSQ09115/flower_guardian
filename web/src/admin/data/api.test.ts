import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  DEFAULT_API_BASE,
  api,
  apiBase,
  getToken,
  login,
  mediaUrl,
  setApiBase,
  setToken,
} from "./api";

const store = new Map<string, string>();

const localStorageStub = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
};

function stubLocation(search: string): void {
  Object.defineProperty(globalThis, "location", {
    value: { search },
    configurable: true,
    writable: true,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageStub,
    configurable: true,
    writable: true,
  });
  stubLocation("");
  setToken("");
  setApiBase("");
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("apiBase", () => {
  it("prefers the ?api= query parameter and strips trailing slashes", () => {
    stubLocation("?api=http://example.test:9000/");
    expect(apiBase()).toBe("http://example.test:9000");
  });

  it("falls back to the stored base url, then to the default", () => {
    setApiBase("http://stored.test:8000///");
    expect(apiBase()).toBe("http://stored.test:8000");
    setApiBase("");
    expect(apiBase()).toBe(DEFAULT_API_BASE);
  });
});

describe("token handling", () => {
  it("stores and clears the admin token", () => {
    setToken("abc123");
    expect(getToken()).toBe("abc123");
    expect(store.get("fg_admin_token")).toBe("abc123");
    setToken("");
    expect(getToken()).toBe("");
    expect(store.has("fg_admin_token")).toBe(false);
  });
});

describe("request errors", () => {
  it("joins array details with the legacy separator", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ detail: [{ msg: "a" }, { msg: "b" }] }, 422)),
    );
    await expect(api.me()).rejects.toMatchObject({
      name: "ApiError",
      message: "a；b",
      status: 422,
    });
  });

  it("passes a string detail through and falls back to the status text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ detail: "没有权限" }, 403)));
    await expect(api.me()).rejects.toMatchObject({ message: "没有权限", status: 403 });

    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    await expect(api.me()).rejects.toMatchObject({ message: "请求失败（500）", status: 500 });
  });

  it("reports a timeout with the legacy wording", async () => {
    vi.useFakeTimers();
    const fetchStub = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        }),
    );
    vi.stubGlobal("fetch", fetchStub);

    const pending = api.me().catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(12_000);
    const error = (await pending) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("请求超时，请检查后端是否启动");
    expect(error.status).toBe(0);
  });
});

describe("login", () => {
  it("posts form-encoded credentials and stores the token", async () => {
    const fetchStub = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ access_token: "token-123" }));
    vi.stubGlobal("fetch", fetchStub);

    const result = await login("admin", "secret");

    expect(result.access_token).toBe("token-123");
    expect(store.get("fg_admin_token")).toBe("token-123");

    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${DEFAULT_API_BASE}/api/users/login`);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(init.body).toBe("username=admin&password=secret");
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("rejects when the response has no access_token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ detail: "ok" })));
    await expect(login("admin", "secret")).rejects.toMatchObject({
      message: "登录响应缺少 access_token",
      status: 0,
    });
  });
});

describe("authenticated requests", () => {
  it("sends the bearer token and JSON bodies", async () => {
    const fetchStub = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ id: 1, name: "绿萝水培套装" }));
    vi.stubGlobal("fetch", fetchStub);
    setToken("token-abc");

    await api.createProduct({
      name: "绿萝水培套装",
      description: "组合",
      price: 35,
      stock: 42,
      plant_id: 1,
      status: "active",
      image_url: null,
    });

    const [url, init] = fetchStub.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${DEFAULT_API_BASE}/api/admin/products`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-abc");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toMatchObject({ name: "绿萝水培套装", price: 35 });
  });

  it("encodes device codes and keeps the legacy endpoints", async () => {
    const fetchStub = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse({ items: [] }));
    vi.stubGlobal("fetch", fetchStub);

    await api.device("FG-ESP32/001");
    await api.deviceReadings("FG-ESP32/001", 48);
    await api.deviceAlerts();
    await api.acknowledgeAlert(7);

    const urls = fetchStub.mock.calls.map((call) => (call as [string])[0]);
    expect(urls[0]).toBe(`${DEFAULT_API_BASE}/api/admin/devices/FG-ESP32%2F001`);
    expect(urls[1]).toBe(`${DEFAULT_API_BASE}/api/admin/devices/FG-ESP32%2F001/readings?hours=48`);
    expect(urls[2]).toBe(`${DEFAULT_API_BASE}/api/admin/device-alerts`);
    expect(urls[3]).toBe(`${DEFAULT_API_BASE}/api/admin/device-alerts/7/ack`);
  });
});

describe("mediaUrl", () => {
  it("resolves backend-relative plant photos against the api origin", () => {
    stubLocation("?api=http://127.0.0.1:8000");
    expect(mediaUrl("/static/plants/绿萝.jpg")).toBe("http://127.0.0.1:8000/static/plants/绿萝.jpg");
  });

  it("passes demo asset paths, remote urls and empty values through", () => {
    expect(mediaUrl("/assets/pothos.jpg")).toBe("/assets/pothos.jpg");
    expect(mediaUrl("https://images.unsplash.com/x.jpg")).toBe("https://images.unsplash.com/x.jpg");
    expect(mediaUrl(null)).toBeNull();
    expect(mediaUrl("")).toBeNull();
  });
});
