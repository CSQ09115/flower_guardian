import { useCallback, useEffect, useState } from "react";
import { AdminIcon } from "../icons";
import { api } from "../data/api";
import type { EmailLog, LogList } from "../data/types";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { Kpi } from "../ui/Kpi";
import { Modal } from "../../shared/components/Modal";
import { Pager } from "../../shared/components/Pager";
import { dateTime, num } from "../data/util";

const PAGE_SIZE = 20;

const PURPOSE_LABEL: Record<string, string> = {
  register: "注册验证",
  password_reset: "密码重置",
  bind_email: "绑定邮箱",
  bind: "绑定邮箱",
  reminder: "养护提醒",
};

export function EmailLogs(): JSX.Element {
  const [data, setData] = useState<LogList<EmailLog> | null>(null);
  const [status, setStatus] = useState<"" | "success" | "failed">("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async (nextStatus: string, nextPage: number): Promise<void> => {
    setLoading(true);
    setError("");
    try {
      const result = await api.emailLogs({
        status: nextStatus || undefined,
        page: nextPage,
        size: PAGE_SIZE,
      });
      setData(result);
      setPage(nextPage);
    } catch (err) {
      setError((err as Error).message || "日志加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(status, 1);
  }, [status, load]);

  const clearFailed = async (): Promise<void> => {
    setClearing(true);
    try {
      await api.deleteFailedEmailLogs();
      setConfirmClear(false);
      setError("");
      await load(status, 1);
    } catch (err) {
      setError((err as Error).message || "清除失败记录出错");
    } finally {
      setClearing(false);
    }
  };

  const items = data?.items ?? [];
  const failed = data?.failed_count ?? 0;

  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <h1>邮件发送日志</h1>
          <p>
            验证码与通知邮件的投递记录，来自 GET /api/admin/email-logs。失败记录会保留原始错误信息，便于排查 SMTP 配置。
          </p>
        </div>
        <div className="page-head__actions">
          <button className="btn btn--ghost" type="button" onClick={() => void load(status, page)}>
            <AdminIcon name="refresh" size={15} />
            刷新
          </button>
          <button
            className="btn btn--coral"
            type="button"
            disabled={!failed}
            onClick={() => setConfirmClear(true)}
          >
            <AdminIcon name="trash" size={15} />
            清除失败记录{failed ? `（${num(failed)}）` : ""}
          </button>
        </div>
      </div>

      <div className="kpis">
        <Kpi label="日志总数" value={num(data?.total ?? 0)} meta="当前筛选条件下的记录" icon="history" tone="rose" />
        <Kpi label="发送成功" value={num(data?.success_count ?? 0)} meta="status = success" icon="check" tone="mint" />
        <Kpi
          label="发送失败"
          value={num(failed)}
          meta="status = failed"
          icon="alert"
          tone={failed ? "coral" : ""}
        />
        <Kpi label="当前页" value={num(items.length)} meta={`第 ${page} 页 · 每页 ${PAGE_SIZE} 条`} icon="filter" />
      </div>

      <section className="card">
        <div className="toolbar">
          <div className="chips" role="group" aria-label="按发送状态筛选">
            {(
              [
                ["", "全部", data?.total ?? 0],
                ["success", "成功", data?.success_count ?? 0],
                ["failed", "失败", failed],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key || "all"}
                className={`chip${status === key ? " is-active" : ""}`}
                type="button"
                aria-pressed={status === key}
                onClick={() => setStatus(key as "" | "success" | "failed")}
              >
                {label}
                <span className="chip__count">{num(count)}</span>
              </button>
            ))}
          </div>
          <span style={{ marginLeft: "auto", color: "var(--muted-2)", fontSize: "11.5px" }}>
            接口：GET /api/admin/email-logs?status=&amp;page=
          </span>
        </div>

        <div className="card__body card__body--flush">
          {error ? (
            <div className="note" style={{ margin: "14px", borderColor: "var(--coral)" }}>
              <AdminIcon name="alert" size={15} />
              <span>{error}</span>
            </div>
          ) : null}
          {loading ? (
            <div className="empty" style={{ padding: "30px" }}>
              <AdminIcon name="refresh" size={24} />
              <b>日志加载中…</b>
            </div>
          ) : items.length ? (
            <div className="table-wrap">
              <table className="table" style={{ minWidth: "860px" }}>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>收件人</th>
                    <th>主题</th>
                    <th>用途</th>
                    <th>状态</th>
                    <th>错误信息</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((log) => (
                    <tr key={log.id}>
                      <td className="nowrap mono" style={{ color: "var(--muted-2)" }}>
                        {dateTime(log.created_at)}
                      </td>
                      <td>{log.recipient}</td>
                      <td style={{ maxWidth: "280px" }}>{log.subject || "—"}</td>
                      <td>
                        <Badge plain>{PURPOSE_LABEL[log.purpose] || log.purpose || "—"}</Badge>
                      </td>
                      <td>
                        {log.status === "success" ? (
                          <Badge tone="ok">成功</Badge>
                        ) : (
                          <Badge tone="danger">失败</Badge>
                        )}
                      </td>
                      <td style={{ maxWidth: "260px" }}>
                        {log.error ? (
                          <span className="mono" style={{ fontSize: "11px", color: "var(--danger)" }}>
                            {log.error}
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted-2)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !error && (
              <EmptyState icon="history" title="没有匹配的日志" size={30}>
                切换筛选条件，或触发一次注册 / 重置密码邮件后再试。
              </EmptyState>
            )
          )}
        </div>
        <Pager
          total={data?.total ?? 0}
          page={page}
          size={PAGE_SIZE}
          onPage={(next) => void load(status, next)}
        />
      </section>

      <Modal
        open={confirmClear}
        title="清除失败记录"
        subtitle={`将调用 DELETE /api/admin/email-logs/failed，删除全部 ${num(failed)} 条失败日志，成功日志不受影响。`}
        onClose={() => setConfirmClear(false)}
        footer={
          <>
            <button className="btn btn--ghost" type="button" onClick={() => setConfirmClear(false)}>
              取消
            </button>
            <button className="btn btn--coral" type="button" disabled={clearing} onClick={() => void clearFailed()}>
              <AdminIcon name="trash" size={14} />
              确认清除
            </button>
          </>
        }
      >
        <div className="note" style={{ marginTop: 0 }}>
          <AdminIcon name="info" size={15} />
          <span>此操作不可撤销。失败记录里的错误信息会被一并删除，如需排查请先截图保存。</span>
        </div>
      </Modal>
    </>
  );
}
