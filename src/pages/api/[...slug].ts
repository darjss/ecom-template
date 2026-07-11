import type { APIRoute } from "astro";
import { app } from "@/server/api/app";

export const prerender = false;

export const ALL: APIRoute = ({ request }) => app.fetch(request);
