import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { background } from "./api";
import { fetch } from "./fetch";

export class StoreWorkflow extends WorkflowEntrypoint<Env, { scheduledAt: string }> {
  override async run(event: Readonly<WorkflowEvent<{ scheduledAt: string }>>, step: WorkflowStep) {
    await step.do("record scheduled tick", async () => {
      await background.recordScheduledTick(new Date(event.payload.scheduledAt));
    });
  }
}

export default {
  fetch,
  scheduled(controller, _environment, context) {
    context.waitUntil(background.recordScheduledTick(new Date(controller.scheduledTime)));
  },
} satisfies ExportedHandler<Env>;
