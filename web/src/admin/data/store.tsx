/* Application state for the admin console: demo data by default, real API
 * after a successful login.
 *
 * Ported from `legacy/admin/assets/js/store.js` (lines 1–100 and 300–429).
 * Differences from the legacy module, all required by the React port:
 *  - the data set lives in React state instead of a module-level `store` object;
 *  - `notify()` became the provider's toast queue (max 4, 3800ms);
 *  - `refreshView()` is unnecessary — state updates re-render on their own.
 *
 * Everything else is unchanged: the same six parallel requests, the same
 * tolerant device/alert shapes, the same demo-mode wording, the same
 * "demo toast first, view toast second" behaviour.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { ToastItem, ToastTone } from "../../shared/components/Toast";
import { api } from "./api";
import { getToken, setToken } from "./api";
import { DEMO_ADMIN, createDemoState } from "./demo";
import type {
  AdminData,
  AdminUser,
  Alert,
  Device,
  Order,
  OrderPatch,
  Plant,
  PlantInput,
  Product,
  ProductInput,
  User,
} from "./types";

export type AdminDataValue = {
  source: "demo" | "live";
  isDemo: boolean;
  admin: AdminUser;
  data: AdminData;
  lastSync: number;
  syncing: boolean;
  toasts: ToastItem[];
  toast: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: number) => void;
  refresh: () => Promise<void>;
  logout: () => void;
  resetDemo: () => void;
  saveProduct: (payload: ProductInput, id?: number) => Promise<void>;
  removeProduct: (id: number) => Promise<void>;
  saveOrder: (id: number, payload: OrderPatch) => Promise<void>;
  savePlant: (payload: PlantInput, id?: number) => Promise<void>;
  removePlant: (id: number) => Promise<void>;
  saveDevice: (code: string, payload: Partial<Device>) => Promise<void>;
  createDevice: (payload: { code: string; name: string; location: string }) => Promise<void>;
  acknowledgeAlert: (id: number) => Promise<void>;
};

/* ── normalisers (legacy `store.js` lines 84–122) ───────────── */

const normalizeProduct = (row: Product): Product => ({
  ...row,
  price: Number(row.price || 0),
  stock: Number(row.stock || 0),
});

const normalizeUser = (row: User): User => ({ ...row });

const normalizePlant = (row: Plant): Plant => ({ ...row, care_level: Number(row.care_level || 1) });

const normalizeOrder = (row: Order): Order => ({
  ...row,
  total_amount: Number(row.total_amount || 0),
  items: (row.items || []).map((item) => ({
    ...item,
    unit_price: Number(item.unit_price || 0),
    subtotal: Number(item.subtotal || item.unit_price * item.quantity || 0),
    quantity: Number(item.quantity || 0),
  })),
});

/* The backend sends snake_case rows; the console works with camelCase
   thresholds/calibration. These raw shapes mirror the legacy normalisers. */
type RawDevice = Omit<Device, "thresholds" | "calibration" | "readings" | "last_seen"> & {
  thresholds?: Device["thresholds"];
  threshold?: Device["thresholds"];
  moisture_min?: number;
  moisture_max?: number;
  temp_min?: number;
  temp_max?: number;
  lux_min?: number;
  lux_max?: number;
  alarm_enabled?: boolean;
  calibration?: Device["calibration"];
  air_raw?: number;
  water_raw?: number;
  readings?: Device["readings"];
  latest_reading?: Device["readings"][number];
  last_seen?: string | null;
  last_seen_at?: string | null;
};

type RawAlert = Alert & { created_at?: string };

export const normalizeDevice = (row: RawDevice): Device => ({
  ...row,
  thresholds: row.thresholds || row.threshold || {
    moistureMin: Number(row.moisture_min ?? 35),
    moistureMax: Number(row.moisture_max ?? 70),
    tempMin: Number(row.temp_min ?? 12),
    tempMax: Number(row.temp_max ?? 30),
    luxMin: Number(row.lux_min ?? 500),
    luxMax: Number(row.lux_max ?? 30000),
    alarm: row.alarm_enabled !== false,
  },
  calibration: row.calibration || {
    airRaw: row.air_raw ?? 3200,
    waterRaw: row.water_raw ?? 1300,
    source: "NVS soil-cal",
  },
  readings: row.readings || (row.latest_reading ? [row.latest_reading] : []),
  last_seen: row.last_seen || row.last_seen_at || null,
});

export const normalizeAlert = (row: RawAlert): Alert => ({
  ...row,
  at: row.at || row.created_at || "",
  acknowledged: Boolean(row.acknowledged),
});

/* ── demo-mode mutations (legacy `store.js` lines 300–429) ──── */

export const DEMO_TOAST = {
  saveProduct: "演示模式：商品修改仅保存在当前会话",
  removeProduct: "演示模式：商品已从当前会话移除",
  saveOrder: "演示模式：订单状态仅保存在当前会话",
  savePlant: "演示模式：植物条目仅保存在当前会话",
  removePlant: "演示模式：植物条目已移除",
  saveDevice: "演示模式：设备配置仅保存在当前会话",
  createDevice: "演示模式：设备档案仅保存在当前会话",
  acknowledgeAlert: "演示模式：告警已确认",
} as const;

export function applySaveProduct(data: AdminData, payload: ProductInput, id?: number): AdminData {
  const stamp = new Date().toISOString();
  if (id) {
    return {
      ...data,
      products: data.products.map((row) =>
        row.id === id ? { ...row, ...payload, updated_at: stamp } : row,
      ),
    };
  }
  const next = Math.max(0, ...data.products.map((row) => row.id)) + 1;
  const row: Product = {
    id: next,
    created_at: stamp,
    updated_at: stamp,
    // The legacy demo row simply had no `image_url`; `null` is the same value
    // the live API returns for a product without a picture.
    image_url: null,
    ...payload,
  };
  return { ...data, products: [row, ...data.products] };
}

export function applyRemoveProduct(data: AdminData, id: number): AdminData {
  return { ...data, products: data.products.filter((row) => row.id !== id) };
}

export function applySaveOrder(data: AdminData, id: number, payload: OrderPatch): AdminData {
  const stamp = new Date().toISOString();
  return {
    ...data,
    orders: data.orders.map((row) => (row.id === id ? { ...row, ...payload, updated_at: stamp } : row)),
  };
}

export function applySavePlant(data: AdminData, payload: PlantInput, id?: number): AdminData {
  if (id) {
    return {
      ...data,
      plants: data.plants.map((row) => (row.id === id ? { ...row, ...payload } : row)),
    };
  }
  const next = Math.max(0, ...data.plants.map((row) => row.id)) + 1;
  const row: Plant = {
    id: next,
    created_at: new Date().toISOString(),
    ...payload,
  } as Plant;
  return { ...data, plants: [row, ...data.plants] };
}

export function applyRemovePlant(data: AdminData, id: number): AdminData {
  return { ...data, plants: data.plants.filter((row) => row.id !== id) };
}

export function applySaveDevice(data: AdminData, code: string, payload: Partial<Device>): AdminData {
  return {
    ...data,
    devices: data.devices.map((row) => {
      if (row.code !== code) return row;
      const next: Device = { ...row, ...payload };
      if (payload.thresholds) next.thresholds = { ...payload.thresholds };
      if (payload.calibration) next.calibration = { ...payload.calibration };
      return next;
    }),
  };
}

export function applyCreateDevice(
  data: AdminData,
  payload: { code: string; name: string; location: string },
): AdminData {
  const row: Device = {
    id: Math.max(0, ...data.devices.map((d) => d.id)) + 1,
    code: payload.code,
    name: payload.name,
    location: payload.location,
    firmware: "—",
    ip_address: null,
    report_interval: 10,
    enabled: true,
    last_seen: null,
    created_at: new Date().toISOString(),
    thresholds: {
      moistureMin: 35,
      moistureMax: 70,
      tempMin: 12,
      tempMax: 30,
      luxMin: 500,
      luxMax: 30000,
      alarm: true,
    },
    calibration: { airRaw: 3200, waterRaw: 1300, source: "出厂默认" },
    readings: [],
  };
  return { ...data, devices: [...data.devices, row] };
}

export function applyAcknowledgeAlert(data: AdminData, id: number): AdminData {
  return {
    ...data,
    alerts: data.alerts.map((row) => (row.id === id ? { ...row, acknowledged: true } : row)),
  };
}

/* ── toast queue ─────────────────────────────────────────────── */

let toastId = 0;

/** Monotonic id source for the toast queue. */
export function nextToastId(): number {
  toastId += 1;
  return toastId;
}

/** Appends a toast, keeping at most the four newest (legacy `#toasts`). */
export function pushToast(
  items: ToastItem[],
  id: number,
  message: string,
  tone: ToastTone = "ok",
): ToastItem[] {
  return [...items, { id, message, tone }].slice(-4);
}

export const TOAST_LIFETIME_MS = 3800;

/* ── provider ────────────────────────────────────────────────── */

const AdminDataContext = createContext<AdminDataValue | null>(null);

export function useAdminDataStore(): AdminDataValue {
  // Legacy `store.source` starts from the token: a stored token means the
  // console was in live mode before. The data itself is always the demo set
  // until `loadLive()` succeeds.
  const [source, setSource] = useState<"demo" | "live">(() => (getToken() ? "live" : "demo"));
  const [data, setData] = useState<AdminData>(() => createDemoState());
  const [admin, setAdmin] = useState<AdminUser>(DEMO_ADMIN);
  const [lastSync, setLastSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = "ok") => {
      const id = nextToastId();
      setToasts((items) => pushToast(items, id, message, tone));
      const timer = window.setTimeout(() => {
        setToasts((items) => items.filter((item) => item.id !== id));
      }, TOAST_LIFETIME_MS);
      timers.current.push(timer);
    },
    [],
  );

  const resetDemo = useCallback(() => {
    setData(createDemoState());
    setAdmin(DEMO_ADMIN);
    setLastSync(Date.now());
  }, []);

  const loadLive = useCallback(async () => {
    setSyncing(true);
    try {
      const [me, products, orders, users, plants, devices] = await Promise.all([
        api.me(),
        api.products(200),
        api.orders(200),
        api.users(200),
        api.plants(200),
        api.devices().catch(() => null),
      ]);
      setAdmin(me);
      setData((prev) => ({
        ...prev,
        products: (products.items || []).map(normalizeProduct),
        orders: (orders.items || []).map(normalizeOrder),
        users: (users.items || []).map(normalizeUser),
        plants: (plants.items || []).map(normalizePlant),
      }));
      if (devices) {
        const rows = Array.isArray(devices) ? devices : devices.items ?? [];
        setData((prev) => ({ ...prev, devices: rows.map(normalizeDevice) }));
        const alerts = await api.deviceAlerts().catch(() => null);
        if (alerts) {
          const list = Array.isArray(alerts) ? alerts : alerts.items ?? [];
          setData((prev) => ({ ...prev, alerts: list.map(normalizeAlert) }));
        }
      } else {
        setData((prev) => ({ ...prev, devices: [], alerts: [] }));
      }
      setSource("live");
      setLastSync(Date.now());
      return true;
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 403) {
        setToken("");
        setSource("demo");
        resetDemo();
      }
      throw error;
    } finally {
      setSyncing(false);
    }
  }, [resetDemo]);

  const refresh = useCallback(async () => {
    if (source === "demo") {
      resetDemo();
      return;
    }
    await loadLive();
  }, [source, resetDemo, loadLive]);

  const logout = useCallback(() => {
    setToken("");
    setSource("demo");
    setAdmin(DEMO_ADMIN);
    resetDemo();
  }, [resetDemo]);

  const saveProduct = useCallback(
    async (payload: ProductInput, id?: number) => {
      if (source === "demo") {
        setData((prev) => applySaveProduct(prev, payload, id));
        toast(DEMO_TOAST.saveProduct);
        return;
      }
      if (id) await api.updateProduct(id, payload);
      else await api.createProduct(payload);
      await loadLive();
      toast(id ? "商品已保存" : "商品已创建");
    },
    [source, toast, loadLive],
  );

  const removeProduct = useCallback(
    async (id: number) => {
      if (source === "demo") {
        setData((prev) => applyRemoveProduct(prev, id));
        toast(DEMO_TOAST.removeProduct);
        return;
      }
      await api.deleteProduct(id);
      await loadLive();
      toast("商品已删除");
    },
    [source, toast, loadLive],
  );

  const saveOrder = useCallback(
    async (id: number, payload: OrderPatch) => {
      if (source === "demo") {
        setData((prev) => applySaveOrder(prev, id, payload));
        toast(DEMO_TOAST.saveOrder);
        return;
      }
      await api.updateOrder(id, payload);
      await loadLive();
      toast("订单已更新");
    },
    [source, toast, loadLive],
  );

  const savePlant = useCallback(
    async (payload: PlantInput, id?: number) => {
      if (source === "demo") {
        setData((prev) => applySavePlant(prev, payload, id));
        toast(DEMO_TOAST.savePlant);
        return;
      }
      if (id) await api.updatePlant(id, payload);
      else await api.createPlant(payload);
      await loadLive();
      toast(id ? "植物条目已保存" : "植物条目已创建");
    },
    [source, toast, loadLive],
  );

  const removePlant = useCallback(
    async (id: number) => {
      if (source === "demo") {
        setData((prev) => applyRemovePlant(prev, id));
        toast(DEMO_TOAST.removePlant);
        return;
      }
      await api.deletePlant(id);
      await loadLive();
      toast("植物条目已删除");
    },
    [source, toast, loadLive],
  );

  const saveDevice = useCallback(
    async (code: string, payload: Partial<Device>) => {
      if (source === "demo") {
        setData((prev) => applySaveDevice(prev, code, payload));
        toast(DEMO_TOAST.saveDevice);
        return;
      }
      await api.updateDevice(code, payload);
      await loadLive();
      toast("设备配置已保存");
    },
    [source, toast, loadLive],
  );

  const createDevice = useCallback(
    async (payload: { code: string; name: string; location: string }) => {
      if (source === "demo") {
        setData((prev) => applyCreateDevice(prev, payload));
        toast(DEMO_TOAST.createDevice);
        return;
      }
      await api.createDevice(payload);
      await loadLive();
      toast("设备档案已创建");
    },
    [source, toast, loadLive],
  );

  const acknowledgeAlert = useCallback(
    async (id: number) => {
      if (source === "demo") {
        setData((prev) => applyAcknowledgeAlert(prev, id));
        toast(DEMO_TOAST.acknowledgeAlert);
        return;
      }
      await api.acknowledgeAlert(id);
      await loadLive();
      toast("告警已确认");
    },
    [source, toast, loadLive],
  );

  const value = useMemo<AdminDataValue>(
    () => ({
      source,
      isDemo: source === "demo",
      admin,
      data,
      lastSync,
      syncing,
      toasts,
      toast,
      dismissToast,
      refresh,
      logout,
      resetDemo,
      saveProduct,
      removeProduct,
      saveOrder,
      savePlant,
      removePlant,
      saveDevice,
      createDevice,
      acknowledgeAlert,
    }),
    [
      source,
      admin,
      data,
      lastSync,
      syncing,
      toasts,
      toast,
      dismissToast,
      refresh,
      logout,
      resetDemo,
      saveProduct,
      removeProduct,
      saveOrder,
      savePlant,
      removePlant,
      saveDevice,
      createDevice,
      acknowledgeAlert,
    ],
  );

  return value;
}

export function AdminDataProvider({ children }: { children: ReactNode }): JSX.Element {
  const value = useAdminDataStore();
  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData(): AdminDataValue {
  const value = useContext(AdminDataContext);
  if (!value) throw new Error("useAdminData 必须在 AdminDataProvider 内使用");
  return value;
}
