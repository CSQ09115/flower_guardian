import { AdminIcon } from "../icons";

/** Placeholder for the 告警记录 view; replaced by the matching task. */
export function Alerts(): JSX.Element {
  return (
    <div className="empty">
      <AdminIcon name="sprout" size={30} />
      <b>告警记录</b>
      <p>正在迁移告警记录视图。</p>
    </div>
  );
}
