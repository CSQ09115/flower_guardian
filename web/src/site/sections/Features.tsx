import { SiteIcon } from "../icons";
import { FEATURES } from "../data/features";

/** Section 05 — capability bento grid, including the three bespoke mini widgets. */
export function Features(): JSX.Element {
  return (
    <section className="section features" id="features" aria-labelledby="features-title">
      <div className="shell">
        <div className="sec-head reveal">
          <p className="kicker">05 / 能力</p>
          <h2 id="features-title">
            不止认得出，
            <br />
            还管得下去。
          </h2>
          <p>识别是入口，提醒、诊断和记录才是每天都会用到的部分。</p>
        </div>

        <div className="bento">
          {FEATURES.map((feature, index) => (
            <article className={index === 0 ? "feature feature--wide reveal" : "feature reveal"} key={feature.title}>
              <div className="feature__head">
                <span
                  className={feature.tone ? `feature__ico feature__ico--${feature.tone}` : "feature__ico"}
                  data-icon={feature.icon}
                  data-size="20"
                >
                  <SiteIcon name={feature.icon} size={20} />
                </span>
                <span className="feature__tag">{feature.tag}</span>
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>

              {feature.extra === "remind" ? (
                <div className="mini-remind">
                  <div className="mini-remind__box">
                    <div className="mini-remind__row">
                      <span className="mini-remind__ico" data-icon="Droplet" data-size="15">
                        <SiteIcon name="Droplet" size={15} />
                      </span>
                      <div>
                        <b>绿萝</b>
                        <small>今天 · 浇水</small>
                      </div>
                      <em>已完成</em>
                    </div>
                    <div className="mini-remind__row">
                      <span className="mini-remind__ico mini-remind__ico--sand" data-icon="Sun" data-size="15">
                        <SiteIcon name="Sun" size={15} />
                      </span>
                      <div>
                        <b>虎皮兰</b>
                        <small>3 天后 · 施肥</small>
                      </div>
                      <em className="is-ghost">延期</em>
                    </div>
                    <div className="mini-remind__row">
                      <span className="mini-remind__ico mini-remind__ico--gray" data-icon="Calendar" data-size="15">
                        <SiteIcon name="Calendar" size={15} />
                      </span>
                      <div>
                        <b>白掌</b>
                        <small>10 月 12 日 · 换盆</small>
                      </div>
                      <em className="is-ghost">延期</em>
                    </div>
                  </div>
                </div>
              ) : null}

              {feature.extra === "chat" ? (
                <div className="mini-chat">
                  <p className="mini-chat__in">叶尖发黄，是不是水多了？</p>
                  <p className="mini-chat__out">先摸一下土。湿的就停水，等干透再浇。</p>
                </div>
              ) : null}

              {feature.extra === "chart" ? (
                <svg
                  className="mini-chart"
                  viewBox="0 0 240 64"
                  role="img"
                  aria-label="生长曲线示意：高度从 24 厘米长到 32 厘米"
                >
                  <path
                    d="M8 52 L48 48 L88 42 L128 34 L168 26 L208 18 L232 13"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="8" cy="52" r="3.5" fill="currentColor" />
                  <circle cx="88" cy="42" r="3.5" fill="currentColor" />
                  <circle cx="168" cy="26" r="3.5" fill="currentColor" />
                  <circle cx="232" cy="13" r="3.5" fill="currentColor" />
                </svg>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}