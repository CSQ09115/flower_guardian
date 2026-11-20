import { AdminIcon } from "../icons";

/** Placeholder for the 植物库 view; replaced by the matching task. */
export function Plants(): JSX.Element {
  return (
    <div className="empty">
      <AdminIcon name="sprout" size={30} />
      <b>植物库</b>
      <p>正在迁移植物库视图。</p>
    </div>
  );
}
