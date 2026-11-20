import { AdminIcon } from "../icons";

/** Placeholder for the 数据统计 view; replaced by the matching task. */
export function Stats(): JSX.Element {
  return (
    <div className="empty">
      <AdminIcon name="sprout" size={30} />
      <b>数据统计</b>
      <p>正在迁移数据统计视图。</p>
    </div>
  );
}
