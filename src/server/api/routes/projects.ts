import { and, desc, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "@/server/db";
import { project } from "@/server/db/schema";
import { NotFoundError } from "../errors";
import { authPlugin } from "../plugins/auth";

const projectBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
});

const ownedProject = (projectId: string, ownerId: string) =>
  and(eq(project.id, projectId), eq(project.ownerId, ownerId));

export const projectsRoute = new Elysia({ prefix: "/projects" })
  .use(authPlugin)
  .get(
    "/",
    ({ user }) =>
      db
        .select()
        .from(project)
        .where(eq(project.ownerId, user.id))
        .orderBy(desc(project.createdAt)),
    {
      requireAuth: true,
    },
  )
  .post(
    "/",
    async ({ user, body, status }) => {
      const [created] = await db
        .insert(project)
        .values({ name: body.name, ownerId: user.id })
        .returning();
      return status(201, created);
    },
    { requireAuth: true, body: projectBody },
  )
  .patch(
    "/:id",
    async ({ user, params, body }) => {
      const [updated] = await db
        .update(project)
        .set({ name: body.name })
        .where(ownedProject(params.id, user.id))
        .returning();
      if (!updated) throw new NotFoundError("Project not found");
      return updated;
    },
    { requireAuth: true, body: projectBody },
  )
  .delete(
    "/:id",
    async ({ user, params }) => {
      const [deleted] = await db
        .delete(project)
        .where(ownedProject(params.id, user.id))
        .returning({ id: project.id });
      if (!deleted) throw new NotFoundError("Project not found");
      return deleted;
    },
    { requireAuth: true },
  );
