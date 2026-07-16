import { handle } from "@astrojs/cloudflare/handler";
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { backend } from "./backend";

export class StoreWorkflow extends WorkflowEntrypoint<Env, { scheduledAt: string }> {
  override async run(event: Readonly<WorkflowEvent<{ scheduledAt: string }>>, step: WorkflowStep) {
    await step.do("record scheduled tick", async () => {
      await backend.background.recordScheduledTick(new Date(event.payload.scheduledAt));
    });
  }
}

export default {
  async fetch(request, environment, context) {
    const pathname = new URL(request.url).pathname;
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return backend.api.fetch(request);
    }
    if (
      pathname.startsWith("/admin") &&
      pathname !== "/admin/login" &&
      !(await backend.hasStaffSession(request))
    ) {
      return Response.redirect(new URL("/admin/login", request.url), 303);
    }
    return handle(request, environment, context);
  },
  scheduled(controller, _environment, context) {
    context.waitUntil(backend.background.recordScheduledTick(new Date(controller.scheduledTime)));
  },
} satisfies ExportedHandler<Env>;
