import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AdminDataProvider } from "./data/store";
import { router } from "./router";
import "./styles/admin.css";

const container = document.getElementById("root");
if (!container) throw new Error("找不到 #root 容器");

/* StrictMode double-invokes effects in development, so the provider's initial
   sync may run twice there; production mounts it once. */
createRoot(container).render(
  <StrictMode>
    <AdminDataProvider>
      <RouterProvider router={router} />
    </AdminDataProvider>
  </StrictMode>,
);
