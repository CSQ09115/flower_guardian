import { useEffect, useState } from "react";
import { api } from "../data/api";
import { getToken } from "../data/api";

export type DevicesOverview = {
  total: number;
  online: number;
  offline: number;
  unacknowledged_alerts: number;
};

const EMPTY: DevicesOverview = { total: 0, online: 0, offline: 0, unacknowledged_alerts: 0 };

/**
 * Polls `GET /api/admin/devices/overview` every 30 seconds so the sidebar badge
 * stays fresh without a full console refresh. Pauses while signed out.
 */
export function useDevicesOverview(signedIn: boolean, intervalMs = 30000): DevicesOverview {
  const [overview, setOverview] = useState<DevicesOverview>(EMPTY);

  useEffect(() => {
    if (!signedIn || !getToken()) {
      setOverview(EMPTY);
      return;
    }
    let alive = true;
    const tick = async (): Promise<void> => {
      try {
        const data = (await api.sensorsOverview()) as DevicesOverview;
        if (alive && data && typeof data.unacknowledged_alerts === "number") {
          setOverview({
            total: Number(data.total || 0),
            online: Number(data.online || 0),
            offline: Number(data.offline || 0),
            unacknowledged_alerts: Number(data.unacknowledged_alerts || 0),
          });
        }
      } catch {
        /* 网络抖动忽略：徽章沿用上一次的值 */
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), intervalMs);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [signedIn, intervalMs]);

  return overview;
}
