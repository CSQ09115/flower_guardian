import { AdminIcon } from "../icons";

/** Placeholder for the 用户管理 view; replaced by the matching task. */
export function Users(): JSX.Element {
  return (
    <div className="empty">
      <AdminIcon name="sprout" size={30} />
      <b>用户管理</b>
      <p>正在迁移用户管理视图。</p>
    </div>
  );
}
