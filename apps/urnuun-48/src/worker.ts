import { WorkerEntrypoint } from "cloudflare:workers";
import { dispatchStoreEntrypointRequest, fetch } from "./fetch";

export class StorefrontCache extends WorkerEntrypoint<Env> {
  override fetch(request: Request): Promise<Response> {
    const mode = request.method === "GET" || request.method === "HEAD" ? "cache" : "mutation";
    return dispatchStoreEntrypointRequest(request, this.env, this.ctx, mode);
  }
}

export default { fetch } satisfies ExportedHandler<Env>;
