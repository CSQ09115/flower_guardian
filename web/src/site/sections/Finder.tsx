import { SiteIcon } from "../icons";
import { FINDER } from "../data/plants";
import { useFinder } from "../hooks/useFinder";

const STEPS: { question: string; options: { value: string; label: string }[] }[] = [
  {
    question: "你家的光，大概是什么样？",
    options: [
      { value: "bright", label: "窗边很亮，有直射" },
      { value: "soft", label: "有散光，不直晒" },
      { value: "low", label: "基本靠灯光" },
    ],
  },
  {
    question: "你多久在家一次？",
    options: [
      { value: "often", label: "经常出差，一走好几天" },
      { value: "sometimes", label: "周末在，平时早出晚归" },
      { value: "home", label: "每天都在家" },
    ],
  },
  {
    question: "家里有猫或小孩吗？",
    options: [
      { value: "yes", label: "有，得放得高一点" },
      { value: "no", label: "没有" },
    ],
  },
];

/**
 * Section 03 — the three-question plant finder. Options lock for 170ms after a
 * pick, then the next question slides in; the third pick swaps the questions
 * for a ranked result with two alternates.
 */
export function Finder(): JSX.Element {
  const { step, picks, done, result, pick, restart } = useFinder();
  const starter = FINDER.pothos;
  const top = result?.top.plant ?? starter;
  const alts = result?.alts ?? [];
  const progress = done ? "100%" : `${((step + 1) / 3) * 100}%`;

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
            <span id="finder-step">{done ? "3 / 3" : `${step + 1} / 3`}</span>
          </div>
          <div className="finder__progress">
            <i id="finder-progress" style={{ width: progress }}></i>
          </div>

          {STEPS.map((entry, index) => (
            <div
              className={index === step ? "finder__step is-active" : "finder__step"}
              data-step={index}
              key={entry.question}
              hidden={done || index !== step}
            >
              <p className="finder__q">{entry.question}</p>
              {entry.options.map((option) => (
                <button
                  className={picks[index] === option.value ? "opt is-picked" : "opt"}
                  type="button"
                  data-value={option.value}
                  key={option.value}
                  onClick={() => pick(option.value)}
                >
                  <span>{option.label}</span>
                  <i data-icon="ArrowRight" data-size="16">
                    <SiteIcon name="ArrowRight" size={16} />
                  </i>
                </button>
              ))}
            </div>
          ))}

          <p className="finder__hint" id="finder-hint" hidden={done}>
            <i data-icon="Clock" data-size="14">
              <SiteIcon name="Clock" size={14} />
            </i>
            三个问题，大约 20 秒；答完直接看到它的养护卡。
          </p>

          <div className="finder__result" id="finder-result" hidden={!done} aria-live="polite">
            <p className="finder__q">先从这一盆开始</p>
            <div className="result-main">
              <img
                id="result-img"
                src={top.img}
                alt={result ? top.alt : ""}
                width={top.w}
                height={top.h}
              />
              <div>
                <span className="result__ease" id="result-ease">
                  难度 · {top.ease}
                </span>
                <h3 id="result-name">{top.name}</h3>
                <p id="result-why">{top.reason}</p>
              </div>
            </div>
            <ul className="result-tags" id="result-tags">
              {top.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
            <p className="result-note" id="result-note">
              {result?.note ?? ""}
            </p>

            <div className="result-alts" id="result-alts">
              {alts.map((entry) => (
                <div className="alt" key={entry.key}>
                  <img src={entry.plant.img} alt={entry.plant.alt} width={entry.plant.w} height={entry.plant.h} />
                  <div>
                    <b>{entry.plant.name}</b>
                    <span>难度 · {entry.plant.ease}</span>
                  </div>
                  <em>备选</em>
                </div>
              ))}
            </div>

            <button className="btn btn--dark btn--full" id="finder-restart" type="button" onClick={restart}>
              重新选一次
            </button>
            <p className="fine">演示结果基于产品里现有的新手推荐逻辑，正式版以 App 内 5 题结果为准。</p>
          </div>
        </div>
      </div>
    </section>
  );
}