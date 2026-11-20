import { SiteIcon } from "../icons";

/**
 * Section 08 — beta application. The copy-to-clipboard behaviour lives in
 * `useApplicationCopy` (Task 20); the form itself mirrors the legacy markup so
 * the CSS for `.setup`, `.field`, `.seg` applies unchanged.
 */
export function Cta(): JSX.Element {
  return (
    <section className="cta" id="beta" aria-labelledby="beta-title">
      <div className="shell cta__grid">
        <div className="cta__copy reveal">
          <p className="kicker kicker--dark">08 / 内测申请</p>
          <h2 id="beta-title">
            从第一盆开始，
            <br />
            建一份看得懂的档案。
          </h2>
          <p>填一个植物名字，选一个摆放位置。我们把内测安装包和它的养护卡一起发给你。</p>
          <ul className="cta__list">
            <li>
              <span data-icon="Check" data-size="16">
                <SiteIcon name="Check" size={16} />
              </span>
              iOS / Android 内测安装包
            </li>
            <li>
              <span data-icon="Check" data-size="16">
                <SiteIcon name="Check" size={16} />
              </span>
              按位置校准的浇水提醒
            </li>
            <li>
              <span data-icon="Check" data-size="16">
                <SiteIcon name="Check" size={16} />
              </span>
              一张属于这盆花的养护卡
            </li>
          </ul>
        </div>

        <form className="setup reveal" id="setup-form">
          <div className="setup__head">
            <span className="setup__mark" data-icon="Leaf" data-size="18">
              <SiteIcon name="Leaf" size={18} />
            </span>
            <div>
              <b>给你的第一盆建档</b>
              <small>两个问题，十秒钟</small>
            </div>
          </div>

          <label className="field">
            <span>它叫什么</span>
            <input
              id="plant-nickname"
              name="nickname"
              type="text"
              defaultValue="窗台上的绿萝"
              maxLength={24}
              autoComplete="off"
            />
          </label>

          <fieldset className="field">
            <legend>放在哪里</legend>
            <div className="seg">
              <label>
                <input type="radio" name="place" value="南阳台" defaultChecked />
                <span>南阳台</span>
              </label>
              <label>
                <input type="radio" name="place" value="北卧室" />
                <span>北卧室</span>
              </label>
              <label>
                <input type="radio" name="place" value="办公室" />
                <span>办公室</span>
              </label>
            </div>
          </fieldset>

          <label className="field">
            <span>想装哪个系统</span>
            <select id="plant-os" name="os" defaultValue="iOS">
              <option>iOS</option>
              <option>Android</option>
              <option>都行</option>
            </select>
          </label>

          <button className="btn btn--dark btn--full" id="beta-submit" type="button">
            <span className="btn__text">复制申请内容</span>
            <span className="btn__check" data-icon="Check" data-size="17">
              <SiteIcon name="Check" size={17} />
            </span>
          </button>
          <p className="setup__note" id="beta-note">
            点一下复制申请内容，粘到邮件或聊天窗口发给我们即可。
          </p>
          <p className="sr-only" id="beta-status" role="status" aria-live="polite"></p>
        </form>
      </div>
      <div className="cta__blend" aria-hidden="true"></div>
    </section>
  );
}