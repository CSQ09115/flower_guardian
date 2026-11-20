import { SPEC, SPEC_NOTE } from "../data/spec";

/** Section 06 — the spec strip. */
export function Spec(): JSX.Element {
  return (
    <section className="spec" id="spec" aria-labelledby="spec-title">
      <div className="shell">
        <div className="spec__grid">
          <div className="spec__head reveal">
            <p className="kicker">06 / 产品规格</p>
            <h2 id="spec-title">
              不猜，
              <br />
              按数据来。
            </h2>
            <p>下面这些数字，都写在产品里，不是宣传口径。</p>
          </div>
          {SPEC.map((row) => (
            <div className="stat reveal" key={row.value}>
              <b>{row.value}</b>
              <span>{row.label}</span>
            </div>
          ))}
        </div>
        <p className="spec__note reveal">{SPEC_NOTE}</p>
      </div>
    </section>
  );
}