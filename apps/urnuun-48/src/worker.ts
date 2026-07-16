import { handle } from "@astrojs/cloudflare/handler";
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { backend } from "./backend";

const privateResponse = (response: Response) => {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "private, no-store");
  headers.delete("cloudflare-cdn-cache-control");
  headers.delete("cache-tag");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

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
      return privateResponse(await backend.api.fetch(request));
    }
    if (
      pathname.startsWith("/admin") &&
      pathname !== "/admin/login" &&
      !(await backend.hasStaffSession(request))
    ) {
      return new Response(null, {
        status: 303,
        headers: {
          location: new URL("/admin/login", request.url).toString(),
          "cache-control": "private, no-store",
        },
      });
    }
    return handle(request, environment, context);
  },
  scheduled(controller, _environment, context) {
    context.waitUntil(backend.background.recordScheduledTick(new Date(controller.scheduledTime)));
  },
} satisfies ExportedHandler<Env>;
