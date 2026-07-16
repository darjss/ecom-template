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
  fetch: handle,
  scheduled(controller, _env, context) {
    context.waitUntil(backend.background.recordScheduledTick(new Date(controller.scheduledTime)));
  },
} satisfies ExportedHandler<Env>;
