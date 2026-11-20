import { AdminIcon } from "../../admin/icons";

/**
 * Port of `pager()` (legacy `admin/assets/js/ui.js`), including the summary copy
 * and the empty-list case: the old views only injected the pager when the
 * filtered list had rows, so `total <= 0` renders nothing.
 *
 * Legacy has no page-number buttons, so the summary `<span>` is the only element
 * that can carry `aria-current="page"` (plan Task 3 step 5). The two buttons stay
 * plain buttons, as before.
 */
export function Pager(props: { total: number; page: number; size: number; onPage: (p: number) => void }): JSX.Element | null {
  const { total, page, size, onPage } = props;
  if (!Number.isFinite(total) || !Number.isFinite(size) || total <= 0 || size <= 0) return null;

  const pages = Math.max(1, Math.ceil(total / size));
  // Display and button targets use the clamped page: legacy printed `page`
  // verbatim, which could show "第 0 / 1 页" for an out-of-range module value.
  const current = Math.min(Math.max(page, 1), pages);

  return (
    <div className="pager">
      <span aria-current="page">
        共 {total} 条 · 第 {current} / {pages} 页
      </span>
      <span className="pager__spacer" />
      <button type="button" className="btn btn--ghost btn--sm" disabled={current <= 1} onClick={() => onPage(current - 1)}>
        <AdminIcon name="chevronLeft" size={13} />
        上一页
      </button>
      <button
        type="button"
        className="btn btn--ghost btn--sm"
        disabled={current >= pages}
        onClick={() => onPage(current + 1)}
      >
        下一页
        <AdminIcon name="chevronRight" size={13} />
      </button>
    </div>
  );
}
