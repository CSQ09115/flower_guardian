import { icon } from "../icons.js";
import { apiBase, login, setApiBase } from "../api.js";
import { loadLive } from "../store.js";
import { toast } from "../ui.js";
import { esc } from "../util.js";

export async function render(root) {
  root.innerHTML = `
    <div class="login">
      <section class="login__brand" aria-label="护花使者">
        <div class="sidebar__brand">
          <img src="../assets/logo.png" alt="" width="42" height="42" decoding="async">
          <span><b>护花使者</b><small>FLOWER GUARDIAN</small></span>
        </div>
        <div>
          <h1>让每一只花盆<br><span>都有读数可循</span></h1>
          <p>运营后台把经营数据与 ESP32 花盆端接在同一处：商品、订单、用户与植物库，加上土壤湿度、土温与光照的实时读数。</p>
          <div class="login__facts">
            <div><small>识别</small><b>47 类常见植物</b></div>
            <div><small>传感器</small><b>湿度 · 光照 · 土温</b></div>
            <div><small>上报</small><b>每 10 秒一次</b></div>
          </div>
        </div>
        <p style="position:relative;color:#dceee2;font-size:11.5px">护花使者 · 管理后台 · 仅限授权管理员</p>
      </section>

      <section class="login__form">
        <div class="login__form-in">
          <h2>登录运营后台</h2>
          <p>使用后端 <code style="font-family:var(--font-mono);font-size:11.5px">role=admin</code> 的账号。登录成功后自动切换到实时接口。</p>

          <form id="login-form" novalidate>
            <div class="field">
              <label for="login-user">${icon("user", { size: 13 })}管理员账号</label>
              <input class="input" id="login-user" name="username" autocomplete="username" required placeholder="用户名">
            </div>
            <div class="field">
              <label for="login-pass">${icon("lock", { size: 13 })}密码</label>
              <input class="input" id="login-pass" name="password" type="password" autocomplete="current-password" required placeholder="密码">
            </div>
            <div id="login-error" style="display:none;color:var(--danger);font-size:12px;padding:8px 10px;background:var(--coral-soft);border-radius:8px"></div>
            <button class="btn" type="submit" id="login-submit">${icon("power", { size: 15 })}登录并连接后端</button>
          </form>

          <div class="login__demo">
            <span style="color:var(--green-2)">${icon("eye", { size: 18 })}</span>
            <span><b>先看演示数据</b><small>不需要后端，写操作只在本次会话生效</small></span>
            <button class="btn btn--ghost btn--sm" type="button" id="login-demo">以演示模式进入</button>
          </div>

          <details style="margin-top:16px">
            <summary style="cursor:pointer;color:var(--muted);font-size:12px">后端地址设置</summary>
            <div class="field" style="margin-top:10px">
              <label for="login-api">API Base</label>
              <input class="input" id="login-api" value="${esc(apiBase())}" placeholder="http://localhost:8000">
              <div class="field__hint">默认 http://localhost:8000；也可用地址栏 ?api= 临时覆盖。</div>
            </div>
            <button class="btn btn--ghost btn--sm" type="button" id="login-save-api">保存地址</button>
          </details>

          <p class="login__hint">演示数据仅用于界面验证，不代表真实经营情况。真实接口下，告警与设备配置需要后端支持 <code>/api/admin/devices</code> 与固件上报接口 <code>/api/devices/{code}/readings</code>。</p>
        </div>
      </section>
    </div>`;

  const form = root.querySelector("#login-form");
  const errorBox = root.querySelector("#login-error");
  const submit = root.querySelector("#login-submit");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.username || !data.password) {
      showError("请填写账号与密码");
      return;
    }
    setApiBase(root.querySelector("#login-api").value.trim() || null);
    submit.disabled = true;
    submit.innerHTML = `${icon("refresh", { size: 15 })}正在连接…`;
    errorBox.style.display = "none";
    try {
      await login(String(data.username).trim(), String(data.password));
      await loadLive();
      toast("已连接实时接口");
      location.hash = "#/overview";
    } catch (error) {
      showError(error.message || "登录失败");
      submit.disabled = false;
      submit.innerHTML = `${icon("power", { size: 15 })}登录并连接后端`;
      const { setToken } = await import("../api.js");
      setToken("");
    }
  });

  root.querySelector("#login-demo").addEventListener("click", () => {
    location.hash = "#/overview";
  });

  root.querySelector("#login-save-api").addEventListener("click", () => {
    setApiBase(root.querySelector("#login-api").value.trim() || null);
    toast("后端地址已保存");
  });

  function showError(message) {
    errorBox.textContent = message;
    errorBox.style.display = "block";
  }
}
