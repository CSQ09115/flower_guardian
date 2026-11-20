import { SiteIcon } from "../icons";

/**
 * Fixed top navigation. Scroll state and the mobile drawer are wired in
 * `useNavScroll` (Task 20); the markup and ARIA hooks come from
 * `legacy/index.html`.
 */
export function Nav(): JSX.Element {
  return (
    <header className="nav" id="top">
      <div className="shell nav__in">
        <a className="brand" href="#top">
          <img className="brand__mark" src="/assets/logo.png" alt="" width="40" height="40" decoding="async" />
          <span className="brand__text">
            <b>护花使者</b>
            <small>FLOWER GUARDIAN</small>
          </span>
        </a>

        <nav className="nav__links" id="nav" aria-label="主导航">
          <a href="#why">为什么</a>
          <a href="#card">养护卡</a>
          <a href="#finder">新手推荐</a>
          <a href="#features">能力</a>
          <a href="#faq">常见问题</a>
        </nav>

        <div className="nav__actions">
          <a className="btn btn--sm" href="#beta">
            申请内测{" "}
            <span className="icon" data-icon="ArrowRight" data-size="16">
              <SiteIcon name="ArrowRight" size={16} />
            </span>
          </a>
          <button className="nav__toggle" type="button" aria-expanded="false" aria-controls="nav" aria-label="打开菜单">
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
    </header>
  );
}