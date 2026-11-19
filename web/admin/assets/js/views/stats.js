import { icon } from "../icons.js";
import { badge, toast } from "../ui.js";
import { movingAverage, store } from "../store.js";
import { STATUS_COLOR, VIZ, barChart, chart, donutChart, hbarChart, sparkline } from "../charts.js";
import { addDays, compactMoney, dayKey, money, num, pad } from "../util.js";

const today = new Date();
let start = dayKey(addDays(today, -13));
let end = dayKey(today);
let groupBy = "day";

const STATUS_ITEMS = [
  ["pending", "待确认"],
  ["confirmed", "已确认"],
  ["shipped", "已发货"],
  ["completed", "已完成"],
  ["cancelled", "已取消"],
];

export async function render(root) {
  const range = compute(start, end, groupBy);
  const ranking = rank(start, end);
  const maWindow = groupBy === "day" ? 7 : 3;
  const average = movingAverage(range.sales, maWindow);
  const statusItems = STATUS_ITEMS
    .filter(([key]) => range.status[key])
    .map(([key, label]) => ({ label, value: range.status[key], color: STATUS_COLOR[key] }));
  const peakHour = range.hours.indexOf(Math.max(...range.hours));
  const fulfilled = range.status.completed + range.status.shipped;
  const fulfillment = range.order_count ? Math.round((fulfilled / range.order_count) * 100) : 0;
  const rankUnits = ranking.reduce((total, row) => total + row.sales_count, 0);
  const rankAmount = ranking.reduce((total, row) => total + row.sales_amount, 0);

  root.innerHTML = `
    <div class="page-head">
      <div class="page-head__main">
        <h1>数据统计</h1>
        <p>按日期范围与粒度查看销售趋势和商品排行。概览与排行使用不同口径，两个金额不应互相对账。</p>
      </div>
      <div class="page-head__actions">
        <button class="btn btn--ghost" type="button" id="st-export">${icon("download", { size: 15 })}导出排行 CSV</button>
      </div>
    </div>

    <section class="card">
      <div class="toolbar">
        <div class="field" style="min-width:150px">
          <label for="st-start">开始日期</label>
          <input class="input" type="date" id="st-start" value="${start}">
        </div>
        <div class="field" style="min-width:150px">
          <label for="st-end">结束日期</label>
          <input class="input" type="date" id="st-end" value="${end}">
        </div>
        <div class="field">
          <span class="field__label">粒度</span>
          <div class="segmented" role="group" aria-label="统计粒度">
            ${[["day", "按日"], ["week", "按周"], ["month", "按月"]].map(([v, label]) => `<button type="button" data-group="${v}" class="${groupBy === v ? "is-active" : ""}" aria-pressed="${groupBy === v}">${label}</button>`).join("")}
          </div>
        </div>
        <div class="chips" style="margin-left:auto">
          ${[7, 14, 30].map((d) => `<button class="chip" type="button" data-quick="${d}">近 ${d} 天</button>`).join("")}
        </div>
        <button class="btn" type="button" id="st-apply">${icon("check", { size: 15 })}应用</button>
      </div>
    </section>

    <div class="kpis" style="margin-top:16px">
      ${kpi("销售额合计", compactMoney(range.total_sales), "区间内全部状态订单", "chart",
        { count: range.total_sales, format: "compact", spark: range.daily.sales, sparkColor: VIZ.leaf, tone: "rose" })}
      ${kpi("订单数", num(range.order_count), "含已取消", "receipt",
        { count: range.order_count, format: "int", spark: range.daily.orders, sparkColor: VIZ.coral, tone: "mint" })}
      ${kpi("客单价", money(range.avg_order_value), "销售额 ÷ 订单数", "gauge",
        { count: range.avg_order_value, format: "money", spark: range.daily.aov, sparkColor: VIZ.green, tone: "pink" })}
      ${kpi("新增用户", num(range.user_count), "按注册时间", "users",
        { count: range.user_count, format: "int", spark: range.daily.users, sparkColor: VIZ.green })}
    </div>

    <section class="card">
      <div class="card__head">
        <div><h2>销售趋势</h2><p>${start} 至 ${end} · ${groupBy === "day" ? "按日" : groupBy === "week" ? "按周" : "按月"} · 含全部状态</p></div>
      </div>
      <div class="card__body">
        ${range.labels.length ? chart({
          labels: range.labels,
          series: [
            { name: "销售额", values: range.sales, color: VIZ.leaf, format: money },
            { name: `${maWindow} 期均线`, values: average, color: VIZ.coral, dashed: true, area: false, format: money },
          ],
          height: 240,
          yMin: 0,
          format: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))),
          xFormat: (label) => (groupBy === "day" ? label.slice(5) : label),
          ariaLabel: "销售额趋势与均线",
        }) : `<div class="empty">${icon("chart", { size: 28 })}<b>区间内没有订单</b></div>`}
        <div class="chart__legend">
          <span><i></i>销售额</span>
          <span><i class="dashed"></i>${maWindow} 期均线</span>
          <span>订单数 ${num(range.order_count)} 笔</span>
        </div>
        <div style="margin-top:16px;border-top:1px solid var(--line);padding-top:14px">
          <div class="fieldset-title">订单数</div>
          ${range.labels.length ? barChart({
            labels: range.labels,
            values: range.orders,
            xFormat: (label) => (groupBy === "day" ? label.slice(5) : label),
            format: (v) => `${v} 笔`,
            colors: range.orders.map((v) => (v === Math.max(...range.orders) && v > 0 ? VIZ.coral : VIZ.leaf)),
            ariaLabel: "订单数柱状图",
          }) : ""}
        </div>
      </div>
    </section>

    <div class="grid-2" style="margin-top:16px">
      <section class="card">
        <div class="card__head">
          <div><h2>商品排行</h2><p>仅统计已完成与已发货订单 · 按销量降序</p></div>
          <div class="card__actions"><span class="badge badge--plain">${ranking.length} 个商品</span></div>
        </div>
        <div class="card__body">
          ${ranking.length
            ? hbarChart({
              rows: ranking.map((row, i) => ({
                label: row.product_name,
                sub: `#${row.product_id}`,
                value: row.sales_count,
                amount: row.sales_amount,
                color: i === 0 ? VIZ.coral : VIZ.green,
              })),
              format: (v) => `${num(v)} 件`,
              meta: (row) => money(row.amount),
              ariaLabel: `商品销量排行，共 ${ranking.length} 个商品`,
            })
            : `<div class="empty">${icon("box", { size: 28 })}<b>区间内没有已完成或已发货订单</b><p>排行只统计 completed 与 shipped 两种状态。</p></div>`}
          ${ranking.length ? `<div class="status-foot">
            <div class="status-foot__row"><span>以上 ${ranking.length} 个商品合计</span><b>${num(rankUnits)} 件 · ${money(rankAmount)}</b></div>
          </div>` : ""}
        </div>
      </section>

      <section class="card">
        <div class="card__head"><div><h2>口径说明</h2><p>同一区间内两组金额通常不相等</p></div></div>
        <div class="card__body">
          <dl class="detail-list">
            <div><dt>概览 / 趋势</dt><dd>包含 pending、confirmed、shipped、completed、cancelled 全部订单，按 <code>total_amount</code> 求和。</dd></div>
            <div><dt>商品排行</dt><dd>只统计 completed 与 shipped，按 <code>OrderItem.subtotal</code> 汇总，按销量降序。</dd></div>
            <div><dt>新增用户</dt><dd>按 <code>User.created_at</code> 落在区间内计数，不是全量用户数。</dd></div>
            <div><dt>客单价</dt><dd>销售额 ÷ 订单数；订单数为 0 时取 0。</dd></div>
          </dl>
          <div class="note">${icon("info", { size: 15 })}<span>排行榜金额合计与概览销售额不应互相对账，这是后端既定口径，不是数据错误。</span></div>
          <div class="note">${icon("info", { size: 15 })}<span>排行最多列出前 10 个商品；页面上的排行与导出的 CSV 使用同一份数据。</span></div>
          <div class="note">${icon("info", { size: 15 })}<span>当前视图在浏览器内按已载入的 ${store.data.orders.length} 笔订单计算；真实接口完整数据以服务端统计接口为准。</span></div>
        </div>
      </section>
    </div>

    <div class="grid-2 grid-2--start" style="margin-top:16px">
      <section class="card">
        <div class="card__head">
          <div><h2>下单时段分布</h2><p>按下单时间的小时归并 · 峰值在 ${peakHour} 时</p></div>
        </div>
        <div class="card__body">
          ${range.order_count
            ? barChart({
              labels: range.hours.map((_, hour) => String(hour)),
              values: range.hours,
              height: 196,
              colors: range.hours.map((v) => (v === Math.max(...range.hours) && v > 0 ? VIZ.coral : VIZ.green)),
              maxBar: 18,
              xFormat: (label) => `${label} 时`,
              format: (v) => `${v} 笔`,
              ariaLabel: "下单时段分布柱状图",
            })
            : `<div class="empty">${icon("clock", { size: 28 })}<b>区间内没有订单</b></div>`}
          <div class="chart__legend"><span><i class="green"></i>订单数，按小时归并</span><span>演示数据按本地时区生成</span></div>
        </div>
      </section>


      <section class="card">
        <div class="card__head">
          <div><h2>订单状态构成</h2><p>同一区间内的 ${num(range.order_count)} 笔订单</p></div>
        </div>
        <div class="card__body">
          ${statusItems.length
            ? `${donutChart({
              items: statusItems,
              centerValue: num(range.order_count),
              centerLabel: "笔订单",
              ariaLabel: `订单状态构成，共 ${range.order_count} 笔`,
            })}
            <div class="status-foot">
              <div class="status-foot__row"><span>已发货 + 已完成</span><b>${num(fulfilled)} / ${num(range.order_count)} 笔 · ${fulfillment}%</b></div>
              <div class="meter meter--wide"><i style="width:${fulfillment}%"></i></div>
            </div>`
            : `<div class="empty">${icon("receipt", { size: 28 })}<b>区间内没有订单</b></div>`}
        </div>
      </section>
    </div>`;

  const startInput = root.querySelector("#st-start");
  const endInput = root.querySelector("#st-end");

  root.querySelectorAll("[data-group]").forEach((btn) => {
    btn.addEventListener("click", () => {
      groupBy = btn.dataset.group;
      root.querySelectorAll("[data-group]").forEach((b) => b.classList.toggle("is-active", b === btn));
      render(root);
    });
  });
  root.querySelectorAll("[data-quick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const days = Number(btn.dataset.quick);
      start = dayKey(addDays(new Date(), -(days - 1)));
      end = dayKey(new Date());
      render(root);
    });
  });
  root.querySelector("#st-apply").addEventListener("click", () => {
    if (!startInput.value || !endInput.value) return toast("请选择开始与结束日期", "error");
    if (startInput.value > endInput.value) return toast("开始日期不能晚于结束日期", "error");
    start = startInput.value;
    end = endInput.value;
    render(root);
    toast("统计已更新");
  });
  root.querySelector("#st-export").addEventListener("click", () => {
    if (!ranking.length) return toast("没有可导出的排行数据", "error");
    import("../util.js").then(({ downloadCsv }) => {
      downloadCsv(`product-ranking-${start}-${end}.csv`, [
        ["排名", "商品ID", "商品", "销量", "销售额"],
        ...ranking.map((row, i) => [i + 1, row.product_id, row.product_name, row.sales_count, row.sales_amount.toFixed(2)]),
      ]);
      toast("排行已导出");
    });
  });
}

function compute(from, to, by) {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T23:59:59`);
  const orders = store.data.orders.filter((o) => {
    const at = new Date(o.created_at);
    return at >= fromDate && at <= toDate;
  });
  const sales = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const users = store.data.users.filter((u) => {
    const at = new Date(u.created_at);
    return at >= fromDate && at <= toDate;
  });

  const buckets = new Map();
  const daily = new Map();
  const cursor = new Date(fromDate);
  while (cursor <= toDate) {
    let key = dayKey(cursor);
    daily.set(key, { sales: 0, orders: 0, users: 0 });
    if (by === "month") key = key.slice(0, 7);
    else if (by === "week") {
      const d = new Date(cursor);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      key = `${d.getFullYear()}-W${pad(weekNumber(d))}`;
    }
    if (!buckets.has(key)) buckets.set(key, { key, sales: 0, orders: 0 });
    if (by === "month") cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  orders.forEach((order) => {
    const at = new Date(order.created_at);
    let key = dayKey(at);
    if (by === "month") key = key.slice(0, 7);
    else if (by === "week") {
      const d = new Date(at);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      key = `${d.getFullYear()}-W${pad(weekNumber(d))}`;
    }
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.sales += Number(order.total_amount || 0);
      bucket.orders += 1;
    }
    const day = daily.get(dayKey(at));
    if (day) {
      day.sales += Number(order.total_amount || 0);
      day.orders += 1;
    }
  });
  users.forEach((user) => {
    const day = daily.get(dayKey(new Date(user.created_at)));
    if (day) day.users += 1;
  });

  const rows = [...buckets.values()];
  const days = [...daily.values()];
  const rollingSales = movingAverage(days.map((d) => d.sales), 7);
  const rollingOrders = movingAverage(days.map((d) => d.orders), 7);
  const hours = new Array(24).fill(0);
  const status = { pending: 0, confirmed: 0, shipped: 0, completed: 0, cancelled: 0 };
  orders.forEach((order) => {
    hours[new Date(order.created_at).getHours()] += 1;
    if (status[order.status] != null) status[order.status] += 1;
  });

  return {
    total_sales: sales,
    order_count: orders.length,
    avg_order_value: orders.length ? sales / orders.length : 0,
    user_count: users.length,
    labels: rows.map((r) => r.key),
    sales: rows.map((r) => r.sales),
    orders: rows.map((r) => r.orders),
    hours,
    status,
    daily: {
      sales: days.map((d) => d.sales),
      orders: days.map((d) => d.orders),
      users: days.map((d) => d.users),
      aov: rollingSales.map((value, i) => (rollingOrders[i] ? value / rollingOrders[i] : 0)),
    },
  };
}

function weekNumber(date) {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
}

function rank(from, to) {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T23:59:59`);
  const map = new Map();
  store.data.orders
    .filter((o) => ["completed", "shipped"].includes(o.status))
    .filter((o) => { const at = new Date(o.created_at); return at >= fromDate && at <= toDate; })
    .forEach((order) => {
      order.items.forEach((item) => {
        const row = map.get(item.product_id) || {
          product_id: item.product_id, product_name: item.product_name, sales_count: 0, sales_amount: 0,
        };
        row.sales_count += Number(item.quantity || 0);
        row.sales_amount += Number(item.subtotal || 0);
        map.set(item.product_id, row);
      });
    });
  return [...map.values()].sort((a, b) => b.sales_count - a.sales_count).slice(0, 10);
}

function kpi(label, value, meta, iconName, { count = null, format = "int", spark = null, sparkColor = VIZ.leaf, tone = "" } = {}) {
  return `<div class="kpi${tone ? ` kpi--${tone}` : ""}">
    <div class="kpi__top"><span class="kpi__label">${label}</span><span class="kpi__icon">${icon(iconName, { size: 15 })}</span></div>
    <div class="kpi__value"${count != null ? ` data-count="${count}" data-count-format="${format}"` : ""}>${value}</div>
    ${spark && spark.length > 1 ? `<span class="kpi__spark">${sparkline(spark, { color: sparkColor })}</span>` : ""}
    <div class="kpi__meta">${meta}</div>
  </div>`;
}