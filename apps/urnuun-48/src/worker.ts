import { WorkerEntrypoint } from "cloudflare:workers";
import { dispatchStoreRequest, fetch } from "./fetch";

export class StorefrontCache extends WorkerEntrypoint<Env> {
  override fetch(request: Request) {
    return dispatchStoreRequest(request, this.env, this.ctx);
  }
}

export default { fetch } satisfies ExportedHandler<Env>;
