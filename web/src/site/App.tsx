import { Nav } from "./sections/Nav";
import { Hero } from "./sections/Hero";
import { Intro } from "./sections/Intro";
import { CareCard } from "./sections/CareCard";
import { Finder } from "./sections/Finder";
import { How } from "./sections/How";
import { Features } from "./sections/Features";
import { Spec } from "./sections/Spec";
import { Faq } from "./sections/Faq";
import { Cta } from "./sections/Cta";
import { Footer } from "./sections/Footer";

/**
 * Marketing page root. Section order and nesting mirror `legacy/index.html`
 * one-to-one so the ported stylesheet keeps computing the same layout.
 */
export function SiteApp(): JSX.Element {
  return (
    <>
      <a className="skip" href="#main">
        跳到正文
      </a>

      <Nav />

      <main id="main">
        <Hero />
        <Intro />
        <CareCard />
        <Finder />
        <How />
        <Features />
        <Spec />
        <Faq />
        <Cta />
      </main>

      <Footer />
    </>
  );
}