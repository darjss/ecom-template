import { For, Match, Switch, createSignal } from "solid-js";
import { toast } from "solid-sonner";
import * as v from "valibot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { queryErrorMessage } from "@/lib/api";
import { createForm } from "@/lib/form";
import { useCreateProject, useDeleteProject, useProjects } from "@/lib/queries/projects";
import { ProjectRow } from "./ProjectRow";

const createSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1, "Name is required")),
});

export const ProjectsPage = () => {
  const projects = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const form = createForm(createSchema);
  const [name, setName] = createSignal("");

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const values = form.validate(event.currentTarget as HTMLFormElement);
    if (!values) return;
    createProject.mutate(values.name, {
      onSuccess: () => setName(""),
      onError: (error) => toast.error(queryErrorMessage(error)),
    });
  };

  const remove = (id: string) =>
    deleteProject.mutate(id, {
      onError: (error) => toast.error(queryErrorMessage(error)),
    });

  return (
    <div class="mx-auto max-w-2xl">
      <h1 class="text-2xl font-bold">Projects</h1>
      <form onSubmit={submit} class="mt-6 flex items-start gap-2">
        <div class="flex-1">
          <Input
            name="name"
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
            placeholder="New project name"
          />
          <p class="text-destructive mt-1 text-sm">{form.errors().name}</p>
        </div>
        <Button type="submit" disabled={createProject.isPending}>
          Create
        </Button>
      </form>
      <Switch>
        <Match when={projects.isPending}>
          <p class="text-muted-foreground mt-6 text-sm">Loading…</p>
        </Match>
        <Match when={projects.isError}>
          <p class="text-destructive mt-6 text-sm">{queryErrorMessage(projects.error)}</p>
        </Match>
        <Match when={projects.data}>
          {(list) => (
            <ul class="mt-6 divide-y rounded-lg border">
              <For
                each={list()}
                fallback={<li class="text-muted-foreground p-4 text-sm">No projects yet.</li>}
              >
                {(item) => <ProjectRow project={item} onDelete={() => remove(item.id)} />}
              </For>
            </ul>
          )}
        </Match>
      </Switch>
    </div>
  );
};
