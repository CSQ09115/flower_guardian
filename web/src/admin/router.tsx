import { createHashRouter, Navigate } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { RootLayout } from "./layout/RootLayout";
import { Alerts } from "./views/Alerts";
import { ApiDocs } from "./views/ApiDocs";
import { ConfigGroup } from "./views/ConfigGroup";
import { DeviceDetail } from "./views/DeviceDetail";
import { Devices } from "./views/Devices";
import { EmailLogs } from "./views/EmailLogs";
import { LoginPage } from "./views/LoginPage";
import { Orders } from "./views/Orders";
import { Overview } from "./views/Overview";
import { Plants } from "./views/Plants";
import { Products } from "./views/Products";
import { SmsLogs } from "./views/SmsLogs";
import { Stats } from "./views/Stats";
import { Users } from "./views/Users";
import { YoloModels } from "./views/YoloModels";

/**
 * Hash router: the legacy console used `location.hash` routes, so deep links
 * such as `#/devices/FG-ESP32-001` keep working without a server rewrite.
 * (`admin/index.html` additionally maps path-style URLs onto hash routes.)
 */
export const router = createHashRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      {
        path: "/",
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/overview" replace /> },
          { path: "overview", element: <Overview /> },
          { path: "stats", element: <Stats /> },
          { path: "devices", element: <Devices /> },
          { path: "devices/:code", element: <DeviceDetail /> },
          { path: "alerts", element: <Alerts /> },
          { path: "products", element: <Products /> },
          { path: "orders", element: <Orders /> },
          { path: "users", element: <Users /> },
          { path: "plants", element: <Plants /> },
          { path: "logs/email", element: <EmailLogs /> },
          { path: "logs/sms", element: <SmsLogs /> },
          /* 静态段 "yolo" 的匹配优先级高于 ":group"，无需在意顺序 */
          { path: "config/yolo", element: <YoloModels /> },
          { path: "config/:group", element: <ConfigGroup /> },
          { path: "docs/api", element: <ApiDocs /> },
          { path: "*", element: <Navigate to="/overview" replace /> },
        ],
      },
    ],
  },
]);
