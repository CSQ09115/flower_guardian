import { useEffect, useRef } from "react";
import { SiteIcon } from "../icons";
import { useApplicationCopy } from "../hooks/useApplicationCopy";

/**
 * Section 08 — beta application. The copy button, its 2.6s 「已复制」 state and
 * the manual-copy fallback all come from `useApplicationCopy`; the markup keeps
 * the legacy form structure so `.setup` / `.field` / `.seg` keep their styles.
 */
export function Cta(): JSX.Element {
  const { nickname, setNickname, place, setPlace, os, setOs, copied, note, manualText, status, submit } =
    useApplicationCopy();
  const manualRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (manualText === null) return;
    manualRef.current?.focus();
    manualRef.current?.select();
  }, [manualText]);

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

        <form
          className="setup reveal"
          id="setup-form"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
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
              value={nickname}
              maxLength={24}
              autoComplete="off"
              onChange={(event) => setNickname(event.target.value)}
            />
          </label>

          <fieldset className="field">
            <legend>放在哪里</legend>
            <div className="seg">
              <label>
                <input
                  type="radio"
                  name="place"
                  value="南阳台"
                  checked={place === "南阳台"}
                  onChange={() => setPlace("南阳台")}
                />
                <span>南阳台</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="place"
                  value="北卧室"
                  checked={place === "北卧室"}
                  onChange={() => setPlace("北卧室")}
                />
                <span>北卧室</span>
              </label>
              <label>
                <input
                  type="radio"
                  name="place"
                  value="办公室"
                  checked={place === "办公室"}
                  onChange={() => setPlace("办公室")}
                />
                <span>办公室</span>
              </label>
            </div>
          </fieldset>

          <label className="field">
            <span>想装哪个系统</span>
            <select id="plant-os" name="os" value={os} onChange={(event) => setOs(event.target.value)}>
              <option>iOS</option>
              <option>Android</option>
              <option>都行</option>
            </select>
          </label>

          {manualText !== null ? (
            <textarea
              id="beta-manual"
              readOnly
              rows={4}
              className="setup__manual"
              ref={manualRef}
              value={manualText}
            />
          ) : null}

          <button
            className={copied ? "btn btn--dark btn--full is-copied" : "btn btn--dark btn--full"}
            id="beta-submit"
            type="button"
            onClick={() => void submit()}
          >
            <span className="btn__text">{copied ? "已复制" : "复制申请内容"}</span>
            <span className="btn__check" data-icon="Check" data-size="17">
              <SiteIcon name="Check" size={17} />
            </span>
          </button>
          <p className="setup__note" id="beta-note">
            {note}
          </p>
          <p className="sr-only" id="beta-status" role="status" aria-live="polite">
            {status}
          </p>
        </form>
      </div>
      <div className="cta__blend" aria-hidden="true"></div>
    </section>
  );
}