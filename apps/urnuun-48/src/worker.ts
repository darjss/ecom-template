import { WorkerEntrypoint } from "cloudflare:workers";
import { dispatchCachedStoreRequest, fetch } from "./fetch";

export class StorefrontCache extends WorkerEntrypoint<Env> {
  override fetch(request: Request) {
    return dispatchCachedStoreRequest(request, this.env, this.ctx);
  }
}

export default { fetch } satisfies ExportedHandler<Env>;
