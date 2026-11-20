import { createHashRouter, Navigate } from "react-router-dom";
import { AppShell } from "./layout/AppShell";
import { Alerts } from "./views/Alerts";
import { DeviceDetail } from "./views/DeviceDetail";
import { Devices } from "./views/Devices";
import { LoginPage } from "./views/LoginPage";
import { Orders } from "./views/Orders";
import { Overview } from "./views/Overview";
import { Plants } from "./views/Plants";
import { Products } from "./views/Products";
import { Stats } from "./views/Stats";
import { Users } from "./views/Users";

/**
 * Hash router: the legacy console used `location.hash` routes, so deep links
 * such as `#/devices/FG-ESP32-001` keep working without a server rewrite.
 */
export const router = createHashRouter([
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
      { path: "*", element: <Navigate to="/overview" replace /> },
    ],
  },
]);
