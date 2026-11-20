import { SiteIcon } from "../icons";

const STEPS: { icon: string; title: string; body: string }[] = [
  { icon: "Camera", title: "拍一张", body: "整株一张，叶子一张。植物识别和病虫害识别两个模型同时看。" },
  { icon: "Leaf", title: "建个档", body: "确认品种，起个名字，选放在南阳台、北卧室还是办公室。" },
  { icon: "Bell", title: "到点提醒", body: "按位置校准浇水间隔。延期一次，下一次提醒会自动往后推。" },
  { icon: "ChartLine", title: "看着它长", body: "每周一张同角度照片，高度和叶片数自己长成一条生命线。" },
];

/** Section 04 — the four-step flow. */
export function How(): JSX.Element {
  return (
    <section className="section how" id="how" aria-labelledby="how-title">
      <div className="shell">
        <div className="sec-head reveal">
          <p className="kicker">04 / 怎么用</p>
          <h2 id="how-title">
            从一张照片，
            <br />
            到一棵活的植物。
          </h2>
          <p>四步，每一步都短。你不需要先学会养花，才能开始养花。</p>
        </div>

        <ol className="steps">
          {STEPS.map((step, index) => (
            <li className="step reveal" key={step.title}>
              <span className="step__no">{String(index + 1).padStart(2, "0")}</span>
              <span className="step__ico" data-icon={step.icon} data-size="22">
                <SiteIcon name={step.icon} size={22} />
              </span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}