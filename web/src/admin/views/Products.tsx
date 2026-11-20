import { AdminIcon } from "../icons";

/** Placeholder for the 商品管理 view; replaced by the matching task. */
export function Products(): JSX.Element {
  return (
    <div className="empty">
      <AdminIcon name="sprout" size={30} />
      <b>商品管理</b>
      <p>正在迁移商品管理视图。</p>
    </div>
  );
}
