import { SiteIcon } from "../icons";
import { useNavScroll } from "../hooks/useNavScroll";

/**
 * Fixed top navigation. Scroll state and the mobile drawer come from
 * `useNavScroll`; markup and ARIA hooks mirror `legacy/index.html`.
 */
export function Nav(): JSX.Element {
  const { scrolled, open, setOpen, toggle, navRef, linksRef, buttonRef } = useNavScroll();

  return (
    <header className={scrolled ? "nav is-scrolled" : "nav"} id="top" ref={navRef}>
      <div className="shell nav__in">
        <a className="brand" href="#top">
          <img className="brand__mark" src="/assets/logo.png" alt="" width="40" height="40" decoding="async" />
          <span className="brand__text">
            <b>护花使者</b>
            <small>FLOWER GUARDIAN</small>
          </span>
        </a>

        <nav
          className={open ? "nav__links is-open" : "nav__links"}
          id="nav"
          aria-label="主导航"
          ref={linksRef}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setOpen(false);
          }}
        >
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
          <button
            className="nav__toggle"
            type="button"
            aria-expanded={open}
            aria-controls="nav"
            aria-label={open ? "关闭菜单" : "打开菜单"}
            onClick={toggle}
            ref={buttonRef}
          >
            <span></span>
            <span></span>
          </button>
        </div>
      </div>
    </header>
  );
}