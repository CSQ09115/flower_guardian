import { createRoot } from "react-dom/client";
import { SiteApp } from "./App";
import "./styles/site.css";

createRoot(document.getElementById("root")!).render(<SiteApp />);