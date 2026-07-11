import Pencil from "lucide-solid/icons/pencil";
import Trash2 from "lucide-solid/icons/trash-2";
import { Show, createSignal } from "solid-js";
import { toast } from "solid-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { queryErrorMessage } from "@/lib/api";
import { useRenameProject } from "@/lib/queries/projects";

interface ProjectRowProps {
  project: { id: string; name: string };
  onDelete: () => void;
}

export const ProjectRow = (props: ProjectRowProps) => {
  const rename = useRenameProject();
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal("");

  const startEditing = () => {
    setDraft(props.project.name);
    setEditing(true);
  };

  const save = (event: SubmitEvent) => {
    event.preventDefault();
    const name = draft().trim();
    if (!name) return;
    rename.mutate(
      { id: props.project.id, name },
      {
        onSuccess: () => setEditing(false),
        onError: (error) => toast.error(queryErrorMessage(error)),
      },
    );
  };

  return (
    <li class="flex items-center gap-2 p-3">
      <Show
        when={editing()}
        fallback={
          <>
            <span class="flex-1 text-sm font-medium">{props.project.name}</span>
            <Button variant="ghost" size="icon-sm" onClick={startEditing} aria-label="Rename">
              <Pencil class="size-4" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={props.onDelete} aria-label="Delete">
              <Trash2 class="size-4" />
            </Button>
          </>
        }
      >
        <form onSubmit={save} class="flex flex-1 items-center gap-2">
          <Input
            value={draft()}
            onInput={(event) => setDraft(event.currentTarget.value)}
            class="h-8"
            autofocus
          />
          <Button type="submit" size="sm" disabled={rename.isPending}>
            Save
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      </Show>
    </li>
  );
};
