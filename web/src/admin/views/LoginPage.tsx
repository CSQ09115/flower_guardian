import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminIcon } from "../icons";
import { apiBase, login, setApiBase, setToken } from "../data/api";
import { useAdminData } from "../data/store";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { LoginShell } from "../layout/LoginShell";
import { Field } from "../../shared/components/Field";

/**
 * Login screen, ported from `legacy/admin/assets/js/views/login.js`: the same
 * copy, the same fields, the same API-base override and the same demo entry.
 */
export function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const { loadLive, toast } = useAdminData();
  useDocumentTitle();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [base, setBase] = useState(apiBase());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!username || !password) {
      setError("请填写账号与密码");
      return;
    }
    setApiBase(base.trim());
    setBusy(true);
    setError("");
    try {
      await login(username.trim(), password);
      await loadLive();
      toast("已连接实时接口");
      navigate("/overview");
    } catch (caught) {
      setError((caught as Error).message || "登录失败");
      setBusy(false);
      setToken("");
    }
  };

  return (
    <LoginShell>
      <section className="login__brand" aria-label="护花使者">
        <div className="sidebar__brand">
          <img src="/assets/logo.png" alt="" width="42" height="42" decoding="async" />
          <span>
            <b>护花使者</b>
            <small>FLOWER GUARDIAN</small>
          </span>
        </div>
        <div>
          <h1>
            让每一只花盆
            <br />
            <span>都有读数可循</span>
          </h1>
          <p>
            运营后台把经营数据与 ESP32
            花盆端接在同一处：商品、订单、用户与植物库，加上土壤湿度、土温与光照的实时读数。
          </p>
          <div className="login__facts">
            <div>
              <small>识别</small>
              <b>47 类常见植物</b>
            </div>
            <div>
              <small>传感器</small>
              <b>湿度 · 光照 · 土温</b>
            </div>
            <div>
              <small>上报</small>
              <b>每 10 秒一次</b>
            </div>
          </div>
        </div>
        <p style={{ position: "relative", color: "#dceee2", fontSize: "11.5px" }}>
          护花使者 · 管理后台 · 仅限授权管理员
        </p>
      </section>

      <section className="login__form">
        <div className="login__form-in">
          <h2>登录运营后台</h2>
          <p>
            使用后端 <code style={{ fontFamily: "var(--font-mono)", fontSize: "11.5px" }}>role=admin</code>{" "}
            的账号。登录成功后自动切换到实时接口。
          </p>

          <form id="login-form" noValidate onSubmit={(event) => void submit(event)}>
            <Field
              label="管理员账号"
              name="login-user"
              value={username}
              onChange={setUsername}
              icon={<AdminIcon name="user" size={13} />}
              placeholder="用户名"
              required
            />
            <Field
              label="密码"
              name="login-pass"
              type="password"
              value={password}
              onChange={setPassword}
              icon={<AdminIcon name="lock" size={13} />}
              placeholder="密码"
              required
            />
            {error ? (
              <div
                id="login-error"
                style={{
                  display: "block",
                  color: "var(--danger)",
                  fontSize: "12px",
                  padding: "8px 10px",
                  background: "var(--coral-soft)",
                  borderRadius: "8px",
                }}
              >
                {error}
              </div>
            ) : (
              <div
                id="login-error"
                style={{ display: "none", color: "var(--danger)", fontSize: "12px", padding: "8px 10px", background: "var(--coral-soft)", borderRadius: "8px" }}
              />
            )}
            <button className="btn" type="submit" id="login-submit" disabled={busy}>
              <AdminIcon name={busy ? "refresh" : "power"} size={15} />
              {busy ? "正在连接…" : "登录并连接后端"}
            </button>
          </form>

          <div className="login__demo">
            <span style={{ color: "var(--green-2)" }}>
              <AdminIcon name="eye" size={18} />
            </span>
            <span>
              <b>先看演示数据</b>
              <small>不需要后端，写操作只在本次会话生效</small>
            </span>
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              id="login-demo"
              onClick={() => navigate("/overview")}
            >
              以演示模式进入
            </button>
          </div>

          <details style={{ marginTop: "16px" }}>
            <summary style={{ cursor: "pointer", color: "var(--muted)", fontSize: "12px" }}>
              后端地址设置
            </summary>
            <div className="field" style={{ marginTop: "10px" }}>
              <label htmlFor="login-api">API Base</label>
              <input
                className="input"
                id="login-api"
                value={base}
                onChange={(event) => setBase(event.target.value)}
                placeholder="http://localhost:8000"
              />
              <div className="field__hint">默认 http://localhost:8000；也可用地址栏 ?api= 临时覆盖。</div>
            </div>
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              id="login-save-api"
              onClick={() => {
                setApiBase(base.trim());
                toast("后端地址已保存");
              }}
            >
              保存地址
            </button>
          </details>

          <p className="login__hint">
            演示数据仅用于界面验证，不代表真实经营情况。真实接口下，告警与设备配置需要后端支持{" "}
            <code>/api/admin/devices</code> 与固件上报接口 <code>/api/devices/{"{code}"}/readings</code>。
          </p>
        </div>
      </section>
    </LoginShell>
  );
}
