import { SiteIcon } from "../icons";
import { FINDER } from "../data/plants";

/**
 * Section 03 — the three-question plant finder. This task ships the static
 * shell: step 1 is visible (progress starts at one third) and the result panel
 * is hidden. `useFinder` (Task 20) advances the steps and fills the result.
 */
export function Finder(): JSX.Element {
  const starter = FINDER.pothos;

  return (
    <section className="section finder" id="finder" aria-labelledby="finder-title">
      <div className="shell finder__grid">
        <div className="finder__copy reveal">
          <p className="kicker">03 / 新手推荐</p>
          <h2 id="finder-title">
            不知道养什么？
            <br />
            先回答三个问题。
          </h2>
          <p>这是产品里“场景化推荐”的简化演示。正式版会问 5 个问题，还会把对猫狗有毒的品种排在你家之外。</p>

          <ul className="finder__points">
            <li>
              <span data-icon="Check" data-size="16">
                <SiteIcon name="Check" size={16} />
              </span>
              按光照、在家的时间、宠物情况来选
            </li>
            <li>
              <span data-icon="Check" data-size="16">
                <SiteIcon name="Check" size={16} />
              </span>
              结果从真实的植物库里出，不是随机抽卡
            </li>
            <li>
              <span data-icon="Check" data-size="16">
                <SiteIcon name="Check" size={16} />
              </span>
              先推荐“养不死榜单”，再谈好看
            </li>
          </ul>
        </div>

        <div className="finder__app reveal" id="finder-app">
          <div className="finder__bar">
            <span>
              <i data-icon="Sparkles" data-size="16">
                <SiteIcon name="Sparkles" size={16} />
              </i>
              养不死测试
            </span>
            <span id="finder-step">1 / 3</span>
          </div>
          <div className="finder__progress">
            <i id="finder-progress"></i>
          </div>

          <div className="finder__step is-active" data-step="0">
            <p className="finder__q">你家的光，大概是什么样？</p>
            <button className="opt" type="button" data-value="bright">
              <span>窗边很亮，有直射</span>
              <i data-icon="ArrowRight" data-size="16">
                <SiteIcon name="ArrowRight" size={16} />
              </i>
            </button>
            <button className="opt" type="button" data-value="soft">
              <span>有散光，不直晒</span>
              <i data-icon="ArrowRight" data-size="16">
                <SiteIcon name="ArrowRight" size={16} />
              </i>
            </button>
            <button className="opt" type="button" data-value="low">
              <span>基本靠灯光</span>
              <i data-icon="ArrowRight" data-size="16">
                <SiteIcon name="ArrowRight" size={16} />
              </i>
            </button>
          </div>

          <div className="finder__step" data-step="1" hidden>
            <p className="finder__q">你多久在家一次？</p>
            <button className="opt" type="button" data-value="often">
              <span>经常出差，一走好几天</span>
              <i data-icon="ArrowRight" data-size="16">
                <SiteIcon name="ArrowRight" size={16} />
              </i>
            </button>
            <button className="opt" type="button" data-value="sometimes">
              <span>周末在，平时早出晚归</span>
              <i data-icon="ArrowRight" data-size="16">
                <SiteIcon name="ArrowRight" size={16} />
              </i>
            </button>
            <button className="opt" type="button" data-value="home">
              <span>每天都在家</span>
              <i data-icon="ArrowRight" data-size="16">
                <SiteIcon name="ArrowRight" size={16} />
              </i>
            </button>
          </div>

          <div className="finder__step" data-step="2" hidden>
            <p className="finder__q">家里有猫或小孩吗？</p>
            <button className="opt" type="button" data-value="yes">
              <span>有，得放得高一点</span>
              <i data-icon="ArrowRight" data-size="16">
                <SiteIcon name="ArrowRight" size={16} />
              </i>
            </button>
            <button className="opt" type="button" data-value="no">
              <span>没有</span>
              <i data-icon="ArrowRight" data-size="16">
                <SiteIcon name="ArrowRight" size={16} />
              </i>
            </button>
          </div>

          <p className="finder__hint" id="finder-hint">
            <i data-icon="Clock" data-size="14">
              <SiteIcon name="Clock" size={14} />
            </i>
            三个问题，大约 20 秒；答完直接看到它的养护卡。
          </p>

          <div className="finder__result" id="finder-result" hidden aria-live="polite">
            <p className="finder__q">先从这一盆开始</p>
            <div className="result-main">
              <img id="result-img" src={starter.img} alt="" width={starter.w} height={starter.h} />
              <div>
                <span className="result__ease" id="result-ease">
                  难度 · {starter.ease}
                </span>
                <h3 id="result-name">{starter.name}</h3>
                <p id="result-why">{starter.reason}</p>
              </div>
            </div>
            <ul className="result-tags" id="result-tags">
              {starter.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
            <p className="result-note" id="result-note"></p>

            <div className="result-alts" id="result-alts"></div>

            <button className="btn btn--dark btn--full" id="finder-restart" type="button">
              重新选一次
            </button>
            <p className="fine">演示结果基于产品里现有的新手推荐逻辑，正式版以 App 内 5 题结果为准。</p>
          </div>
        </div>
      </div>
    </section>
  );
}