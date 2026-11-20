import { createRoot, hydrateRoot } from "react-dom/client";
import { SiteApp } from "./App";
import "./styles/site.css";

const container = document.getElementById("root")!;
const app = <SiteApp />;

/* The build writes prerendered markup into #root; the dev server leaves it empty. */
if (container.hasChildNodes()) hydrateRoot(container, app);
else createRoot(container).render(app);