import { createSignal } from "solid-js";
import { toast } from "solid-sonner";
import * as v from "valibot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, useSession } from "@/lib/auth-client";
import { createForm } from "@/lib/form";

const schema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1, "Name is required")),
});

export const ProfileSettings = () => {
  const session = useSession();
  const form = createForm(schema);
  const [pending, setPending] = createSignal(false);

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    const values = form.validate(event.currentTarget as HTMLFormElement);
    if (!values) return;
    setPending(true);
    const result = await authClient.updateUser({ name: values.name });
    setPending(false);
    if (result.error) {
      toast.error(result.error.message ?? "Update failed");
      return;
    }
    toast.success("Profile updated");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} class="flex items-end gap-2">
          <div class="flex flex-1 flex-col gap-1.5">
            <Label for="profile-name">Name</Label>
            <Input id="profile-name" name="name" value={session().data?.user.name ?? ""} />
            <p class="text-destructive text-sm">{form.errors().name}</p>
          </div>
          <Button type="submit" disabled={pending()}>
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
