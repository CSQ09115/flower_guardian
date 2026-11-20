import { useState } from "react";
import { AdminIcon } from "../icons";
import { Modal } from "../../shared/components/Modal";
import { dateTime, DELIVERY_TYPE, money, ORDER_STATUS } from "../data/util";
import type { Order, OrderStatus, User } from "../data/types";

/**
 * Order detail dialog. Ported from `openDetail()` in
 * `legacy/admin/assets/js/views/orders.js`: the same two columns (items and
 * recipient) plus the status picker.
 */
export function OrderDetail({
  order,
  user,
  onClose,
  onSave,
}: {
  order: Order | null;
  user: User | undefined;
  onClose: () => void;
  onSave: (status: OrderStatus) => Promise<void>;
}): JSX.Element | null {
  const [status, setStatus] = useState<OrderStatus>(order?.status ?? "pending");

  if (!order) return null;

  return (
    <Modal
      open
      wide
      title={`订单 ${order.order_no}`}
      subtitle={`${dateTime(order.created_at)} · ${DELIVERY_TYPE[order.delivery_type] || order.delivery_type || "—"}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            关闭
          </button>
          <button
            className="btn"
            type="button"
            id="o-save"
            onClick={() => void onSave(status)}
          >
            <AdminIcon name="check" size={15} />
            保存状态
          </button>
        </>
      }
    >
      <div className="grid-2" style={{ gap: "18px" }}>
        <div>
          <div className="fieldset-title">订单项</div>
          <div className="order-items">
            {order.items.map((item) => (
              <div className="order-item" key={item.id}>
                <div>
                  <b>{item.product_name}</b>
                  <small>
                    {money(item.unit_price)} × {item.quantity}
                  </small>
                </div>
                <span className="num">{money(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: "12px",
              paddingTop: "10px",
              borderTop: "1px solid var(--line)",
            }}
          >
            <span style={{ color: "var(--muted)", fontSize: "12px" }}>订单总额</span>
            <b
              style={{
                marginLeft: "auto",
                fontSize: "18px",
                color: "var(--green-2)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {money(order.total_amount)}
            </b>
          </div>
        </div>
        <div>
          <div className="fieldset-title">收件与用户</div>
          <dl className="detail-list">
            <div>
              <dt>用户</dt>
              <dd>{user?.username || "—"}</dd>
            </div>
            <div>
              <dt>邮箱</dt>
              <dd>{user?.email || "—"}</dd>
            </div>
            <div>
              <dt>联系人</dt>
              <dd>
                {order.contact_name || "—"} {order.contact_phone || ""}
              </dd>
            </div>
            <div>
              <dt>地址</dt>
              <dd>{order.delivery_address || "—"}</dd>
            </div>
            <div>
              <dt>备注</dt>
              <dd>{order.remark || "无"}</dd>
            </div>
            <div>
              <dt>更新时间</dt>
              <dd>{dateTime(order.updated_at)}</dd>
            </div>
          </dl>
        </div>
      </div>
      <div style={{ marginTop: "18px", paddingTop: "14px", borderTop: "1px solid var(--line)" }}>
        <div className="field">
          <label htmlFor="f-orderStatus">订单状态</label>
          <select
            className="select"
            id="f-orderStatus"
            name="orderStatus"
            style={{ width: "100%" }}
            value={status}
            onChange={(event) => setStatus(event.target.value as OrderStatus)}
          >
            {Object.entries(ORDER_STATUS).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
          <div className="field__hint">状态流转没有强制顺序，按实际履约情况选择即可。</div>
        </div>
      </div>
    </Modal>
  );
}
