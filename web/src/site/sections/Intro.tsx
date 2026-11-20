/** Section 01 — why the product exists. Copy is verbatim from the legacy page. */
export function Intro(): JSX.Element {
  return (
    <section className="section intro" id="why" aria-labelledby="why-title">
      <div className="shell intro__grid">
        <div className="intro__head reveal">
          <p className="kicker">01 / 为什么是护花使者</p>
          <h2 id="why-title">
            识别只是入口，
            <br />
            养下去才是正文。
          </h2>
        </div>

        <div className="intro__body">
          <p className="intro__lead reveal">
            大多数植物识别 App 到“这是绿萝”就结束了。护花使者接着往下写：它喜欢什么光、多久浇一次、最常见的死法是什么，以及你家这个位置该怎么调整。
          </p>

          <ol className="principles">
            <li className="reveal">
              <span className="principles__no">01</span>
              <div>
                <h3>先给答案，再给知识</h3>
                <p>不甩术语。放哪、多久浇、别做什么，三句话说完。</p>
              </div>
            </li>
            <li className="reveal">
              <span className="principles__no">02</span>
              <div>
                <h3>一张卡只写这一盆</h3>
                <p>光照、水分、温度、常见死法，不是复制粘贴的通用攻略。</p>
              </div>
            </li>
            <li className="reveal">
              <span className="principles__no">03</span>
              <div>
                <h3>提醒跟着环境走</h3>
                <p>南阳台和北卧室，本来就不该用同一个浇水间隔。</p>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}