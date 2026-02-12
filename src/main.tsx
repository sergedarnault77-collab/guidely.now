import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./routeTree.gen";

import { SubscriptionProvider } from "@/lib/subscription";
import { CloudStatusProvider } from "@/lib/cloud-status";
import { HabitProvider } from "@/lib/context";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SubscriptionProvider>
      <CloudStatusProvider>
        <HabitProvider>
          <RouterProvider router={router} />
        </HabitProvider>
      </CloudStatusProvider>
    </SubscriptionProvider>
  </React.StrictMode>
);
