import { A, type RouteSectionProps } from "@solidjs/router";
import LogOut from "lucide-solid/icons/log-out";
import { For } from "solid-js";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";
import { navItems } from "./nav";

const logout = async () => {
  await signOut();
  window.location.assign("/login");
};

export const AppLayout = (props: RouteSectionProps) => (
  <div class="flex min-h-screen">
    <aside class="flex w-56 flex-col border-r p-4">
      <a href="/" class="px-2 text-lg font-bold">
        SaaS Starter
      </a>
      <nav class="mt-6 flex flex-1 flex-col gap-1">
        <For each={navItems}>
          {(item) => (
            <A
              href={item.href}
              end={item.href === "/app"}
              class="hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
              activeClass="bg-accent font-medium"
            >
              <item.icon class="size-4" />
              {item.label}
            </A>
          )}
        </For>
      </nav>
      <Button variant="ghost" class="justify-start" onClick={logout}>
        <LogOut class="size-4" />
        Sign out
      </Button>
    </aside>
    <main class="flex-1 p-8">{props.children}</main>
  </div>
);
