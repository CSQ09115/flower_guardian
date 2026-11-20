import { SiteIcon } from "../icons";
import { CARE, PLANT_KEYS } from "../data/plants";
import { useCareTabs } from "../hooks/useCareTabs";

/**
 * Section 02 — the care card. Click, arrow keys and Home/End move between the
 * six plants; the panel replays its entrance animation on every switch.
 */
export function CareCard(): JSX.Element {
  const { active, select, onKeyDown, tabRefs, panelRef } = useCareTabs();
  const plant = CARE[active];

  return (
    <section className="section card-sec" id="card" aria-labelledby="card-title">
      <div className="shell">
        <div className="sec-head reveal">
          <p className="kicker">02 / 养护卡</p>
          <h2 id="card-title">
            一张卡，
            <br />
            写清这盆花怎么活。
          </h2>
          <p>下面六张卡，从 App 的 47 类植物库里抽出来。点名字换一张，养护要点一个字没改。</p>
        </div>

        <div className="card-layout">
          <div
            className="tabs reveal"
            role="tablist"
            aria-label="选择一种植物"
            aria-orientation="vertical"
            onKeyDown={onKeyDown}
          >
            {PLANT_KEYS.map((key, index) => (
              <button
                key={key}
                className={key === active ? "tab is-active" : "tab"}
                id={`tab-${key}`}
                role="tab"
                aria-selected={key === active}
                aria-controls="care-panel"
                tabIndex={key === active ? 0 : -1}
                data-plant={key}
                type="button"
                ref={(element) => {
                  tabRefs.current[key] = element;
                }}
                onClick={() => select(key)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                {CARE[key].name}
              </button>
            ))}
            <p className="tabs__note">养护要点来自 App 原文。你自己的植物，还会多一栏：上次浇水是什么时候。</p>
          </div>

          <article
            className="care reveal"
            id="care-panel"
            role="tabpanel"
            aria-labelledby={`tab-${active}`}
            tabIndex={0}
            ref={panelRef}
          >
            <div className="care__photo">
              <img
                id="care-photo"
                src={plant.img}
                alt={plant.alt}
                width={plant.w}
                height={plant.h}
              />
              <span className="care__badge">47 类植物库</span>
              <span className="care__corner" aria-hidden="true">
                Care Card
              </span>
            </div>
            <div className="care__body" aria-live="polite">
              <header className="care__head">
                <div>
                  <p className="care__kicker">养护档案</p>
                  <h3 id="care-name">{plant.name}</h3>
                </div>
                <span className="care__ease" id="care-ease">
                  难度 · {plant.ease}
                </span>
              </header>

              <p className="care__tip" id="care-tip">
                {plant.tip}
              </p>
              <ul className="care__tags" id="care-tags">
                {plant.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>

              <dl className="care__grid">
                <div>
                  <dt>
                    <i data-icon="Sun" data-size="16">
                      <SiteIcon name="Sun" size={16} />
                    </i>
                    光照
                  </dt>
                  <dd id="care-light">{plant.light}</dd>
                </div>
                <div>
                  <dt>
                    <i data-icon="Droplet" data-size="16">
                      <SiteIcon name="Droplet" size={16} />
                    </i>
                    水分
                  </dt>
                  <dd id="care-water">{plant.water}</dd>
                </div>
                <div>
                  <dt>
                    <i data-icon="Window" data-size="16">
                      <SiteIcon name="Window" size={16} />
                    </i>
                    位置
                  </dt>
                  <dd id="care-place">{plant.place}</dd>
                </div>
                <div>
                  <dt>
                    <i data-icon="Clock" data-size="16">
                      <SiteIcon name="Clock" size={16} />
                    </i>
                    下次浇水
                  </dt>
                  <dd id="care-next">{plant.next}</dd>
                </div>
              </dl>

              <div className="care__warn">
                <span className="care__warn-ico" data-icon="ShieldCheck" data-size="18">
                  <SiteIcon name="ShieldCheck" size={18} />
                </span>
                <p>
                  <b>常见死法</b>
                  <span id="care-warn">{plant.warn}</span>
                </p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}