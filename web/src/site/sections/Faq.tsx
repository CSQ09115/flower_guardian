import { FAQ } from "../data/faq";

/** Section 07 — FAQ, ported as native `<details>` so it still works without JS. */
export function Faq(): JSX.Element {
  return (
    <section className="section faq-sec" id="faq" aria-labelledby="faq-title">
      <div className="shell faq__grid">
        <div className="faq__head reveal">
          <p className="kicker">07 / 常见问题</p>
          <h2 id="faq-title">
            你可能
            <br />
            还想知道。
          </h2>
          <p>没写到的，发邮件问我们。内测期间回得慢一点，但都会回。</p>
        </div>

        <div className="faq reveal">
          {FAQ.map((item, index) => (
            <details key={item.q} open={index === 0}>
              <summary>
                <span>{item.q}</span>
                <span className="faq__plus" aria-hidden="true"></span>
              </summary>
              <div className="faq__body">
                <p>{item.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}