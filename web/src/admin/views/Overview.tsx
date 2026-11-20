import { AdminIcon } from "../icons";

/** Placeholder for the 概览 view; replaced by the matching task. */
export function Overview(): JSX.Element {
  return (
    <div className="empty">
      <AdminIcon name="sprout" size={30} />
      <b>概览</b>
      <p>正在迁移经营概览视图。</p>
    </div>
  );
}
