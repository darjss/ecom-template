// TODO: this is the per-project swap point — replace this hero with your product's own.

import ArrowRight from "lucide-solid/icons/arrow-right";
import { createSignal } from "solid-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Hero = () => {
  const [prompt, setPrompt] = createSignal("");

  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    const value = prompt().trim();
    const target = value ? `/app?prompt=${encodeURIComponent(value)}` : "/app";
    window.location.assign(target);
  };

  return (
    <section class="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-24 text-center">
      <h1 class="text-4xl font-bold tracking-tight md:text-6xl">Ship your SaaS in days</h1>
      <p class="text-muted-foreground max-w-xl text-lg">
        Auth, billing, and a typed API on Cloudflare. Describe what you want to build and jump
        straight in.
      </p>
      <form onSubmit={submit} class="flex w-full max-w-xl items-center gap-2">
        <Input
          value={prompt()}
          onInput={(event) => setPrompt(event.currentTarget.value)}
          placeholder="What are you building?"
          class="h-12 flex-1"
        />
        <Button type="submit" size="lg" class="h-12">
          Start
          <ArrowRight class="size-4" />
        </Button>
      </form>
    </section>
  );
};
