import { SiteIcon } from "../icons";

/**
 * First screen: copy on the left, a static phone mock on the right. The stage
 * is decorative (`aria-hidden`), so every icon inside stays out of the tree.
 */
export function Hero(): JSX.Element {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero__wash" aria-hidden="true"></div>
      <div className="shell hero__grid">
        <div className="hero__copy">
          <p className="eyebrow reveal">
            <span className="eyebrow__dot"></span>植物管家 · 内测中
          </p>
          <h1 id="hero-title" className="reveal">
            让养花
            <br />
            <span className="hl">不再凭感觉</span>
          </h1>
          <p className="hero__lede reveal">
            拍一张照片，认出它叫什么、该怎么养；再按你家的光照，提醒你什么时候浇水。养花这件事，终于有了说明书。
          </p>

          <div className="hero__cta reveal">
            <a className="btn" href="#beta">
              领取内测名额{" "}
              <span className="icon" data-icon="ArrowRight" data-size="18">
                <SiteIcon name="ArrowRight" size={18} />
              </span>
            </a>
            <a className="btn btn--ghost" href="#card">
              先看一张养护卡
            </a>
          </div>

          <ul className="hero__facts reveal" aria-label="产品概况">
            <li>
              <b>47</b>
              <span>类常见植物</span>
            </li>
            <li>
              <b>2</b>
              <span>个识别模型</span>
            </li>
            <li>
              <b>4</b>
              <span>类养护提醒</span>
            </li>
          </ul>
        </div>

        <div className="hero__stage" aria-hidden="true">
          <div className="hero__sun"></div>
          <div className="hero__ring"></div>

          <div className="phone">
            <div className="phone__notch"></div>
            <div className="phone__screen">
              <div className="phone__status">
                <span>9:41</span>
                <span className="phone__sig">
                  <i></i>
                  <i></i>
                  <i></i>
                </span>
              </div>

              <div className="app-top">
                <div>
                  <small>周五 · 晴 24°</small>
                  <strong>早上好</strong>
                </div>
                <span className="app-avatar" data-icon="User" data-size="18">
                  <SiteIcon name="User" size={18} />
                </span>
              </div>

              <div className="app-plant">
                <img src="/assets/pothos.jpg" alt="" width="1200" height="750" {...{ fetchpriority: "high" }} />
                <span className="app-plant__tag">今天浇水</span>
                <div className="app-plant__text">
                  <strong>窗台上的绿萝</strong>
                  <span>南阳台 · 散光</span>
                </div>
              </div>

              <div className="app-sec">
                <span>接下来</span>
                <em>2 件</em>
              </div>

              <div className="app-row">
                <span className="app-row__ico" data-icon="Droplet" data-size="16">
                  <SiteIcon name="Droplet" size={16} />
                </span>
                <div>
                  <strong>浇水</strong>
                  <small>绿萝 · 今天 09:00</small>
                </div>
                <span className="app-chip">完成</span>
              </div>
              <div className="app-row">
                <span className="app-row__ico app-row__ico--sand" data-icon="Sun" data-size="16">
                  <SiteIcon name="Sun" size={16} />
                </span>
                <div>
                  <strong>施肥</strong>
                  <small>虎皮兰 · 3 天后</small>
                </div>
                <span className="app-chip app-chip--ghost">延期</span>
              </div>

              <div className="app-note">
                <span data-icon="Sparkles" data-size="14">
                  <SiteIcon name="Sparkles" size={14} />
                </span>
                土表干了再浇，别按日子硬浇。
              </div>

              <div className="app-tabs">
                <span className="is-on">
                  <i data-icon="Camera" data-size="18">
                    <SiteIcon name="Camera" size={18} />
                  </i>
                  识别
                </span>
                <span>
                  <i data-icon="Leaf" data-size="18">
                    <SiteIcon name="Leaf" size={18} />
                  </i>
                  花园
                </span>
                <span>
                  <i data-icon="Book" data-size="18">
                    <SiteIcon name="Book" size={18} />
                  </i>
                  百科
                </span>
                <span>
                  <i data-icon="User" data-size="18">
                    <SiteIcon name="User" size={18} />
                  </i>
                  我的
                </span>
              </div>
            </div>
          </div>

          <div className="float float--id">
            <span className="float__ico" data-icon="Search" data-size="18">
              <SiteIcon name="Search" size={18} />
            </span>
            <div>
              <strong>虎皮兰</strong>
              <small>已加入我的花园</small>
            </div>
          </div>
          <div className="float float--water">
            <span className="float__ico float__ico--coral" data-icon="Droplet" data-size="18">
              <SiteIcon name="Droplet" size={18} />
            </span>
            <div>
              <strong>下次浇水</strong>
              <small>3 天后 · 周四</small>
            </div>
          </div>
          <div className="float float--count">
            <strong>47</strong>
            <span>
              类植物
              <br />
              随手拍
            </span>
          </div>
          <p className="stage-note">界面示意 · 数据为演示状态</p>
        </div>
      </div>

      <div className="hero__strip">
        <div className="shell hero__strip-in">
          <span>
            <i data-icon="Camera" data-size="18">
              <SiteIcon name="Camera" size={18} />
            </i>
            拍一张
          </span>
          <i className="hero__strip-arrow" data-icon="ArrowRight" data-size="14">
            <SiteIcon name="ArrowRight" size={14} />
          </i>
          <span>
            <i data-icon="Leaf" data-size="18">
              <SiteIcon name="Leaf" size={18} />
            </i>
            建个档
          </span>
          <i className="hero__strip-arrow" data-icon="ArrowRight" data-size="14">
            <SiteIcon name="ArrowRight" size={14} />
          </i>
          <span>
            <i data-icon="Bell" data-size="18">
              <SiteIcon name="Bell" size={18} />
            </i>
            到点提醒
          </span>
          <i className="hero__strip-arrow" data-icon="ArrowRight" data-size="14">
            <SiteIcon name="ArrowRight" size={14} />
          </i>
          <span>
            <i data-icon="ChartLine" data-size="18">
              <SiteIcon name="ChartLine" size={18} />
            </i>
            看着它长
          </span>
        </div>
      </div>
    </section>
  );
}