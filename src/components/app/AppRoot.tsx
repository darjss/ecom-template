import { Route, Router } from "@solidjs/router";
import { QueryClientProvider } from "@tanstack/solid-query";
import { Toaster } from "solid-sonner";
import { queryClient } from "@/lib/query-client";
import { AppLayout } from "./AppLayout";
import { AdminPage } from "./routes/AdminPage";
import { BillingPage } from "./routes/BillingPage";
import { ProjectsPage } from "./routes/ProjectsPage";
import { SettingsPage } from "./routes/SettingsPage";

export const AppRoot = () => (
  <QueryClientProvider client={queryClient}>
    <Router base="/app" root={AppLayout}>
      <Route path="/" component={ProjectsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/billing" component={BillingPage} />
      <Route path="/admin" component={AdminPage} />
    </Router>
    <Toaster richColors />
  </QueryClientProvider>
);
