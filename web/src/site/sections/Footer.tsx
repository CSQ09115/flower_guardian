import { SiteIcon } from "../icons";

/** Page footer, including the image credits block. Copy and links are verbatim. */
export function Footer(): JSX.Element {
  return (
    <footer className="foot" aria-labelledby="foot-name">
      <div className="shell">
        <div className="foot__top">
          <div className="foot__brand">
            <a className="brand brand--foot" href="#top">
              <img className="brand__mark" src="/assets/logo.png" alt="" width="40" height="40" decoding="async" />
              <span className="brand__text">
                <b id="foot-name">护花使者</b>
                <small>FLOWER GUARDIAN</small>
              </span>
            </a>
            <p>
              你的掌上植物管家，
              <br />
              让养花不再凭感觉。
            </p>
          </div>

          <div className="foot__nav">
            <div>
              <p>产品</p>
              <a href="#card">养护卡</a>
              <a href="#finder">新手推荐</a>
              <a href="#features">智能提醒</a>
              <a href="#features">病害诊断</a>
            </div>
            <div>
              <p>了解</p>
              <a href="#spec">技术规格</a>
              <a href="#faq">常见问题</a>
              <a href="#beta">内测申请</a>
            </div>
            <div>
              <p>更多</p>
              <a href="#why">设计原则</a>
              <a href="#how">使用流程</a>
              <a href="admin/">运营后台</a>
              <a href="#top">回到顶部</a>
            </div>
          </div>
        </div>

        <div className="foot__bottom">
          <div>
            <p>护花使者 Flower Guardian · 内测版官网 · 2026</p>
            <p className="foot__credits">
              图片：Wikimedia Commons，{" "}
              <a
                href="https://commons.wikimedia.org/wiki/File%3APotted_Aloe_vera_plant.jpg"
                target="_blank"
                rel="noopener"
              >
                芦荟 © Arjun01（公有领域）
              </a>{" "}
              <a
                href="https://commons.wikimedia.org/wiki/File%3ASansevieria_trifasciata_12zz.jpg"
                target="_blank"
                rel="noopener"
              >
                虎皮兰 © David J. Stang（CC BY-SA 4.0）
              </a>{" "}
              <a
                href="https://commons.wikimedia.org/wiki/File%3AEpipremnum_aureum_%28Marble_Queen%29_houseplant_%28cropped%29.png"
                target="_blank"
                rel="noopener"
              >
                绿萝 © Spnq（CC BY-SA 4.0）
              </a>{" "}
              <a
                href="https://commons.wikimedia.org/wiki/File%3AHedera_helix_leaf.jpg"
                target="_blank"
                rel="noopener"
              >
                常春藤 © Max Ronnersjö（CC BY-SA 3.0）
              </a>{" "}
              <a
                href="https://commons.wikimedia.org/wiki/File%3AMonstera_deliciosa_4.jpg"
                target="_blank"
                rel="noopener"
              >
                龟背竹 © Cryptosporella（CC BY-SA 3.0）
              </a>{" "}
              <a
                href="https://commons.wikimedia.org/wiki/File%3APeace_lily_-_2.jpg"
                target="_blank"
                rel="noopener"
              >
                白掌 © W.carter（CC BY-SA 4.0）
              </a>{" "}
              图标：
              <a href="https://reicon.dev" target="_blank" rel="noopener">
                Reicon
              </a>
              （MIT）。
            </p>
          </div>
          <a className="foot__top-link" href="#top">
            回到顶部{" "}
            <span data-icon="ArrowUpRight" data-size="16">
              <SiteIcon name="ArrowUpRight" size={16} />
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}