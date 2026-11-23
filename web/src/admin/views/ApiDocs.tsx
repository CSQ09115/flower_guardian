import { AdminIcon } from "../icons";
import { Badge } from "../ui/Badge";

type DocItem = {
  method: string;
  path: string;
  desc: string;
};

type DocSection = {
  title: string;
  note?: string;
  items: DocItem[];
};

const METHOD_TONE: Record<string, string> = {
  GET: "info",
  POST: "ok",
  PUT: "warn",
  DELETE: "danger",
};

const SECTIONS: DocSection[] = [
  {
    title: "认证",
    note: "登录使用 OAuth2 表单编码（application/x-www-form-urlencoded），其余接口用 Authorization: Bearer <access_token>。",
    items: [
      { method: "POST", path: "/api/users/login", desc: "登录，表单字段 username / password，返回 access_token" },
      { method: "GET", path: "/api/users/me", desc: "当前登录用户信息" },
    ],
  },
  {
    title: "商品管理",
    items: [
      { method: "GET", path: "/api/admin/products?limit=100", desc: "商品列表（分页信封 {total, items}）" },
      { method: "POST", path: "/api/admin/products", desc: "创建商品" },
      { method: "PUT", path: "/api/admin/products/{id}", desc: "更新商品" },
      { method: "DELETE", path: "/api/admin/products/{id}", desc: "删除商品" },
    ],
  },
  {
    title: "订单管理",
    items: [
      { method: "GET", path: "/api/admin/orders?limit=100", desc: "订单列表（含 items 明细与用户摘要）" },
      { method: "PUT", path: "/api/admin/orders/{id}", desc: "更新订单状态（status）" },
      { method: "POST", path: "/api/admin/orders/batch-delete", desc: "批量删除，body {\"ids\":[…]}，返回 {deleted}" },
    ],
  },
  {
    title: "用户管理",
    items: [
      { method: "GET", path: "/api/admin/users?limit=100", desc: "用户列表" },
      { method: "POST", path: "/api/admin/users/batch-delete", desc: "批量删除，body {\"ids\":[…]}" },
    ],
  },
  {
    title: "植物库",
    items: [
      { method: "GET", path: "/api/admin/plants?limit=100", desc: "植物条目列表" },
      { method: "POST", path: "/api/admin/plants", desc: "创建植物条目" },
      { method: "PUT", path: "/api/admin/plants/{id}", desc: "更新植物条目" },
      { method: "DELETE", path: "/api/admin/plants/{id}", desc: "删除植物条目" },
      { method: "POST", path: "/api/admin/plants/batch-delete", desc: "批量删除，body {\"ids\":[…]}" },
    ],
  },
  {
    title: "经营统计",
    items: [
      { method: "GET", path: "/api/admin/stats/overview", desc: "总销售额 / 订单数 / 客单价 / 用户数" },
      { method: "GET", path: "/api/admin/stats/trend?group_by=day", desc: "销售趋势（day / week / month）" },
      { method: "GET", path: "/api/admin/stats/products?limit=10", desc: "商品销量排行" },
    ],
  },
  {
    title: "花盆设备",
    note: "设备列表 / 详情只带 latest_reading；完整历史走 readings 接口（hours ≤ 720，limit ≤ 500）。",
    items: [
      { method: "GET", path: "/api/admin/devices", desc: "设备列表（分页信封，含阈值与标定）" },
      { method: "GET", path: "/api/admin/devices/overview", desc: "总数 / 在线 / 离线 / 未确认告警数" },
      { method: "POST", path: "/api/admin/devices", desc: "创建设备档案（code/name/location，可带阈值）" },
      { method: "GET", path: "/api/admin/devices/{code}", desc: "设备详情" },
      { method: "PUT", path: "/api/admin/devices/{code}", desc: "更新名称/位置/启停/阈值/标定" },
      { method: "DELETE", path: "/api/admin/devices/{code}", desc: "删除设备（级联清理读数与告警）" },
      { method: "GET", path: "/api/admin/devices/{code}/readings?hours=24&limit=500", desc: "历史读数（倒序数组）" },
      { method: "POST", path: "/api/devices/{code}/readings", desc: "固件上报读数（首次上报自动注册）" },
      { method: "GET", path: "/api/devices", desc: "设备公开列表（App 用，含最新读数与浇水建议）" },
    ],
  },
  {
    title: "设备告警",
    items: [
      { method: "GET", path: "/api/device-alerts", desc: "告警列表（分页信封 {total, page, page_size, items}）" },
      { method: "POST", path: "/api/device-alerts/{id}/acknowledge", desc: "确认告警" },
    ],
  },
  {
    title: "邮件 / 短信日志",
    items: [
      { method: "GET", path: "/api/admin/email-logs?status=&page=&size=", desc: "邮件发送日志（含 success_count / failed_count）" },
      { method: "DELETE", path: "/api/admin/email-logs/failed", desc: "清除全部失败邮件日志" },
      { method: "GET", path: "/api/admin/sms-logs?status=&page=&size=", desc: "短信发送日志" },
      { method: "DELETE", path: "/api/admin/sms-logs/failed", desc: "清除全部失败短信日志" },
    ],
  },
  {
    title: "系统配置",
    note: "分组：weather / smtp / sms / ai / payment / login。secret 字段只回传 configured 标记，PUT 时留空表示保持原值。",
    items: [
      { method: "GET", path: "/api/admin/system-config", desc: "读取全部分组与字段（含默认值）" },
      { method: "PUT", path: "/api/admin/system-config/{group}", desc: "保存分组，body {\"values\":{\"字段\":\"值\"}}" },
      { method: "GET", path: "/api/admin/system-config/yolo/models", desc: "YOLO 模型列表（plant / pest）" },
      { method: "POST", path: "/api/admin/system-config/yolo/{kind}/upload", desc: "上传模型（multipart file 字段）" },
      { method: "PUT", path: "/api/admin/system-config/yolo/{kind}/active", desc: "切换启用模型，body {\"filename\":\"…\"}" },
      { method: "DELETE", path: "/api/admin/system-config/yolo/{kind}/models/{filename}", desc: "删除模型文件" },
    ],
  },
  {
    title: "业务端（App / 小程序）",
    note: "植物百科、识别、问诊、天气、购物车、支付、地址、提醒、日记等接口同样挂在 /api 前缀下，完整清单见 Swagger。",
    items: [
      { method: "GET", path: "/api/plants", desc: "植物百科公开列表" },
      { method: "POST", path: "/api/recognition", desc: "植物图像识别" },
      { method: "GET", path: "/api/weather/…", desc: "天气查询（依赖系统配置 weather 组）" },
      { method: "POST", path: "/api/payments", desc: "支付（模拟流程）" },
    ],
  },
];

export function ApiDocs(): JSX.Element {
  return (
    <>
      <div className="page-head">
        <div className="page-head__main">
          <h1>API 对接文档</h1>
          <p>
            后端 FastAPI 主要接口速查。交互式调试请打开
            <a href="/docs" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
              Swagger UI（/docs）
            </a>
            ，机器可读的 OpenAPI 描述在
            <a href="/openapi.json" target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
              /openapi.json
            </a>
            。
          </p>
        </div>
        <div className="page-head__actions">
          <a className="btn" href="/docs" target="_blank" rel="noreferrer">
            <AdminIcon name="external" size={15} />
            打开 Swagger
          </a>
        </div>
      </div>

      <div className="note" style={{ marginBottom: "16px" }}>
        <AdminIcon name="info" size={15} />
        <span>
          除登录外，所有 /api/admin/** 接口都需要 Bearer Token；批量删除与清除失败日志属于不可恢复操作，请谨慎调用。
        </span>
      </div>

      {SECTIONS.map((section) => (
        <section className="card" key={section.title} style={{ marginBottom: "16px" }}>
          <div className="card__head">
            <div>
              <h2>{section.title}</h2>
              {section.note ? <p>{section.note}</p> : null}
            </div>
          </div>
          <div className="card__body card__body--flush">
            <div className="table-wrap">
              <table className="table" style={{ minWidth: "640px" }}>
                <thead>
                  <tr>
                    <th style={{ width: "92px" }}>方法</th>
                    <th>路径</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((item) => (
                    <tr key={`${item.method}-${item.path}`}>
                      <td>
                        <Badge tone={METHOD_TONE[item.method] || "plain"}>{item.method}</Badge>
                      </td>
                      <td className="mono" style={{ fontSize: "11.5px" }}>
                        {item.path}
                      </td>
                      <td style={{ color: "var(--muted)" }}>{item.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ))}

      <div className="card">
        <div className="card__body">
          <div className="fieldset-title">固件对接示例</div>
          <div
            className="mono"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              background: "var(--surface-2)",
              border: "1px solid var(--line)",
              borderRadius: "10px",
              padding: "10px 12px",
              overflowX: "auto",
              whiteSpace: "pre",
              lineHeight: 1.7,
            }}
          >
            {`POST /api/devices/FG-ESP32-001/readings
Content-Type: application/json

{
  "soil_moisture": 33.1,
  "soil_temp": 21.5,
  "light_lux": null,
  "firmware": "0.5.0",
  "ip_address": "10.47.86.6"
}`}
          </div>
          <div className="field__hint" style={{ marginTop: "8px" }}>
            设备首次上报会自动注册档案；上报间隔由固件 report_interval 控制，阈值与告警在后台设备详情页调整。
          </div>
        </div>
      </div>
    </>
  );
}
