import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import "./index.css";

import { SubscriptionProvider } from "@/lib/subscription";
import { CloudStatusProvider } from "@/lib/cloud-status";
import { HabitProvider } from "@/lib/context";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Initialize Convex client only if VITE_CONVEX_URL is present
const convexUrl = import.meta.env.VITE_CONVEX_URL;
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

const root = document.getElementById("root")!;
const app = (
  <HabitProvider>
    <RouterProvider router={router} />
  </HabitProvider>
);

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <SubscriptionProvider>
      <CloudStatusProvider>
        {convexClient ? (
          <ConvexProvider client={convexClient}>{app}</ConvexProvider>
        ) : (
          app
        )}
      </CloudStatusProvider>
    </SubscriptionProvider>
  </React.StrictMode>
);