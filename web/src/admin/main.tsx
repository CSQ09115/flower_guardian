import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AdminDataProvider } from "./data/store";
import { router } from "./router";
import "./styles/admin.css";

const container = document.getElementById("root");
if (!container) throw new Error("找不到 #root 容器");

/* StrictMode double-invokes effects in development; the data provider must
   therefore never sync with the backend on mount — it only does so when the
   operator asks for it. */
createRoot(container).render(
  <StrictMode>
    <AdminDataProvider>
      <RouterProvider router={router} />
    </AdminDataProvider>
  </StrictMode>,
);
