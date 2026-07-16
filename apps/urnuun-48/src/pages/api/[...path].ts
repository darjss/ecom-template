import type { APIRoute } from "astro";
import { backend } from "../../backend";

export const prerender = false;
export const ALL: APIRoute = ({ request }) => backend.api.fetch(request);
