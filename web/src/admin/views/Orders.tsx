import { AdminIcon } from "../icons";

/** Placeholder for the 订单管理 view; replaced by the matching task. */
export function Orders(): JSX.Element {
  return (
    <div className="empty">
      <AdminIcon name="sprout" size={30} />
      <b>订单管理</b>
      <p>正在迁移订单管理视图。</p>
    </div>
  );
}
