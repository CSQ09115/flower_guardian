/* Application state for the admin console. Every row comes from the
 * PostgreSQL-backed API; the console has no offline dataset and never falls
 * back to sample rows.
 *
 * A stored token starts the session optimistically, then the first `loadLive()`
 * either fills the store or, on 401/403, clears the token and sends the user
 * back to the login screen.
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
  Reading,
  User,
} from "./types";

export type AdminDataValue = {
  /** False once the token is missing, rejected, or cleared by `logout()`. */
  signedIn: boolean;
  admin: AdminUser;
  data: AdminData;
  lastSync: number;
  syncing: boolean;
  toasts: ToastItem[];
  toast: (message: string, tone?: ToastTone) => void;
  dismissToast: (id: number) => void;
  refresh: () => Promise<void>;
  loadLive: () => Promise<boolean>;
  loadDevice: (code: string) => Promise<void>;
  logout: () => void;
  saveProduct: (payload: ProductInput, id?: number) => Promise<void>;
  removeProduct: (id: number) => Promise<void>;
  saveOrder: (id: number, payload: OrderPatch) => Promise<void>;
  savePlant: (payload: PlantInput, id?: number) => Promise<void>;
  removePlant: (id: number) => Promise<void>;
  saveDevice: (code: string, payload: Partial<Device>) => Promise<void>;
  createDevice: (payload: { code: string; name: string; location: string }) => Promise<void>;
  removeDevice: (code: string) => Promise<void>;
  acknowledgeAlert: (id: number) => Promise<void>;
  /** POST /api/admin/{plants|users|orders}/batch-delete，返回实际删除数。 */
  batchRemove: (kind: "plants" | "users" | "orders", ids: number[]) => Promise<number>;
};

export const EMPTY_DATA: AdminData = {
  products: [],
  plants: [],
  users: [],
  orders: [],
  devices: [],
  alerts: [],
};

const EMPTY_ADMIN: AdminUser = { id: 0, username: "", role: "admin", avatar_url: null };

/* ── normalisers ────────────────────────────────────────────── */

/* FastAPI serialises the backend's naive `datetime.utcnow()` values without a
   timezone (`2026-11-21T02:00:00`). `new Date()` would read that as local time,
   shifting every row by the UTC offset — and marking every device offline,
   because `last_seen` would look hours old. Tag the string as UTC so the rest
   of the console parses it correctly. */
const utcStamp = (value: string): string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? `${value}Z`
    : value;

const normalizeReading = (row: Reading): Reading => ({
  ...row,
  created_at: utcStamp(row.created_at),
});

const normalizeProduct = (row: Product): Product => ({
  ...row,
  price: Number(row.price || 0),
  stock: Number(row.stock || 0),
  created_at: utcStamp(row.created_at),
  updated_at: utcStamp(row.updated_at),
});

const normalizeUser = (row: User): User => ({ ...row, created_at: utcStamp(row.created_at) });

const normalizePlant = (row: Plant): Plant => ({
  ...row,
  care_level: Number(row.care_level || 1),
  created_at: utcStamp(row.created_at),
});

const normalizeOrder = (row: Order): Order => ({
  ...row,
  total_amount: Number(row.total_amount || 0),
  created_at: utcStamp(row.created_at),
  updated_at: utcStamp(row.updated_at),
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
  air_temp_min?: number;
  air_temp_max?: number;
  air_humidity_min?: number;
  air_humidity_max?: number;
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

export const normalizeDevice = (row: RawDevice): Device => {
  /* The list endpoint returns `readings: []` plus a `latest_reading`, so an
     empty array must not shadow the latest point. The detail endpoint returns
     the full 24h history in `readings`. */
  const readings =
    row.readings && row.readings.length
      ? row.readings
      : row.latest_reading
        ? [row.latest_reading]
        : [];

  return {
    ...row,
    thresholds: row.thresholds || row.threshold || {
      moistureMin: Number(row.moisture_min ?? 35),
      moistureMax: Number(row.moisture_max ?? 70),
      tempMin: Number(row.temp_min ?? 12),
      tempMax: Number(row.temp_max ?? 30),
      airTempMin: Number(row.air_temp_min ?? 5),
      airTempMax: Number(row.air_temp_max ?? 35),
      airHumidityMin: Number(row.air_humidity_min ?? 20),
      airHumidityMax: Number(row.air_humidity_max ?? 90),
      luxMin: Number(row.lux_min ?? 500),
      luxMax: Number(row.lux_max ?? 30000),
      alarm: row.alarm_enabled !== false,
    },
    calibration: row.calibration || {
      airRaw: row.air_raw ?? 3200,
      waterRaw: row.water_raw ?? 1300,
      source: "NVS soil-cal",
    },
    readings: readings.map(normalizeReading),
    last_seen: utcStamp(row.last_seen || row.last_seen_at || "") || null,
  };
};

export const normalizeAlert = (row: RawAlert): Alert => ({
  ...row,
  at: utcStamp(row.at || row.created_at || ""),
  acknowledged: Boolean(row.acknowledged),
});

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

const isAuthError = (error: unknown): boolean => {
  const status = (error as { status?: number }).status;
  return status === 401 || status === 403;
};

export function useAdminDataStore(): AdminDataValue {
  const [signedIn, setSignedIn] = useState<boolean>(() => Boolean(getToken()));
  const [data, setData] = useState<AdminData>(EMPTY_DATA);
  const [admin, setAdmin] = useState<AdminUser>(EMPTY_ADMIN);
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

  /** Drops the session so the route guard can bounce to `/login`. */
  const signOut = useCallback(() => {
    setToken("");
    setSignedIn(false);
    setData(EMPTY_DATA);
    setAdmin(EMPTY_ADMIN);
    setLastSync(0);
  }, []);

  const loadLive = useCallback(async () => {
    setSyncing(true);
    try {
      /* The backend caps every list endpoint at `limit<=100`, so asking for
         more returns 422. */
      const [me, products, orders, users, plants, devicesResult] = await Promise.all([
        api.me(),
        api.products(100),
        api.orders(100),
        api.users(100),
        api.plants(100),
        api.devices().catch(() => null),
      ]);
      const devices = devicesResult
        ? Array.isArray(devicesResult)
          ? devicesResult
          : devicesResult.items ?? []
        : [];
      let alerts: Alert[] = [];
      if (devicesResult) {
        const alertsResult = await api.deviceAlerts().catch(() => null);
        if (alertsResult) {
          const list = Array.isArray(alertsResult) ? alertsResult : alertsResult.items ?? [];
          alerts = list.map(normalizeAlert);
        }
      }
      setAdmin(me);
      setData({
        products: (products.items || []).map(normalizeProduct),
        orders: (orders.items || []).map(normalizeOrder),
        users: (users.items || []).map(normalizeUser),
        plants: (plants.items || []).map(normalizePlant),
        devices: devices.map(normalizeDevice),
        alerts,
      });
      setSignedIn(true);
      setLastSync(Date.now());
      return true;
    } catch (error) {
      if (isAuthError(error)) signOut();
      throw error;
    } finally {
      setSyncing(false);
    }
  }, [signOut]);

  /* The device list only carries the latest point; the detail page needs the
     full history. Fetch the profile and the readings history in parallel and
     merge them into the same store (readings sorted oldest → newest). */
  const loadDevice = useCallback(
    async (code: string) => {
      try {
        const [row, readings] = await Promise.all([
          api.device(code),
          api.deviceReadings(code, 24, 500).catch(() => null),
        ]);
        setData((prev) => ({
          ...prev,
          devices: prev.devices.map((device) =>
            device.code === code
              ? normalizeDevice({
                  ...(row as RawDevice),
                  readings: readings && readings.length ? [...readings].reverse() : undefined,
                })
              : device,
          ),
        }));
      } catch (error) {
        if (isAuthError(error)) {
          signOut();
          return;
        }
        /* Network hiccup: keep the list snapshot instead of blanking the page. */
      }
    },
    [signOut],
  );

  const refresh = useCallback(async () => {
    await loadLive();
  }, [loadLive]);

  /* Restore the session from the stored token on mount. */
  useEffect(() => {
    if (!getToken()) return;
    void loadLive().catch((error) => {
      if (!isAuthError(error)) {
        toast(`同步失败：${(error as Error).message}`, "error");
      }
    });
  }, [loadLive, toast]);

  const logout = useCallback(() => {
    signOut();
  }, [signOut]);

  const saveProduct = useCallback(
    async (payload: ProductInput, id?: number) => {
      if (id) await api.updateProduct(id, payload);
      else await api.createProduct(payload);
      await loadLive();
      toast(id ? "商品已保存" : "商品已创建");
    },
    [toast, loadLive],
  );

  const removeProduct = useCallback(
    async (id: number) => {
      await api.deleteProduct(id);
      await loadLive();
      toast("商品已删除");
    },
    [toast, loadLive],
  );

  const saveOrder = useCallback(
    async (id: number, payload: OrderPatch) => {
      await api.updateOrder(id, payload);
      await loadLive();
      toast("订单已更新");
    },
    [toast, loadLive],
  );

  const savePlant = useCallback(
    async (payload: PlantInput, id?: number) => {
      if (id) await api.updatePlant(id, payload);
      else await api.createPlant(payload);
      await loadLive();
      toast(id ? "植物条目已保存" : "植物条目已创建");
    },
    [toast, loadLive],
  );

  const removePlant = useCallback(
    async (id: number) => {
      await api.deletePlant(id);
      await loadLive();
      toast("植物条目已删除");
    },
    [toast, loadLive],
  );

  const saveDevice = useCallback(
    async (code: string, payload: Partial<Device>) => {
      await api.updateDevice(code, payload);
      /* Re-fetch the detail so the 24h curve survives the update response,
         which only carries the device profile. */
      await loadDevice(code);
      toast("设备配置已保存");
    },
    [toast, loadDevice],
  );

  const createDevice = useCallback(
    async (payload: { code: string; name: string; location: string }) => {
      await api.createDevice(payload);
      await loadLive();
      toast("设备档案已创建");
    },
    [toast, loadLive],
  );

  const removeDevice = useCallback(
    async (code: string) => {
      await api.deleteDevice(code);
      await loadLive();
      toast("设备已删除");
    },
    [toast, loadLive],
  );

  const batchRemove = useCallback(
    async (kind: "plants" | "users" | "orders", ids: number[]) => {
      const result = await api.batchDelete(kind, ids);
      const deleted = result?.deleted ?? ids.length;
      await loadLive();
      toast(`批量删除完成：${deleted} 条`);
      return deleted;
    },
    [toast, loadLive],
  );

  const acknowledgeAlert = useCallback(
    async (id: number) => {
      await api.acknowledgeAlert(id);
      await loadLive();
      toast("告警已确认");
    },
    [toast, loadLive],
  );

  const value = useMemo<AdminDataValue>(
    () => ({
      signedIn,
      admin,
      data,
      lastSync,
      syncing,
      toasts,
      toast,
      dismissToast,
      refresh,
      loadLive,
      loadDevice,
      logout,
      saveProduct,
      removeProduct,
      saveOrder,
      savePlant,
      removePlant,
      saveDevice,
      createDevice,
      removeDevice,
      acknowledgeAlert,
      batchRemove,
    }),
    [
      signedIn,
      admin,
      data,
      lastSync,
      syncing,
      toasts,
      toast,
      dismissToast,
      refresh,
      loadLive,
      loadDevice,
      logout,
      saveProduct,
      removeProduct,
      saveOrder,
      savePlant,
      removePlant,
      saveDevice,
      createDevice,
      removeDevice,
      acknowledgeAlert,
      batchRemove,
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
