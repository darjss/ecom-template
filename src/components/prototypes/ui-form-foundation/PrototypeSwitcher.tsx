import ArrowLeft from "lucide-solid/icons/arrow-left";
import ArrowRight from "lucide-solid/icons/arrow-right";
import { onCleanup, onMount } from "solid-js";

export type PrototypeVariant = "A" | "B" | "C";

const variants: { id: PrototypeVariant; label: string }[] = [
  { id: "A", label: "Guided document" },
  { id: "B", label: "Focused sections" },
  { id: "C", label: "Storefront preview" },
];

export const PrototypeSwitcher = (props: {
  current: () => PrototypeVariant;
  onChange: (variant: PrototypeVariant) => void;
}) => {
  const cycle = (direction: -1 | 1) => {
    const index = variants.findIndex((variant) => variant.id === props.current());
    const next = variants[(index + direction + variants.length) % variants.length];
    if (next) props.onChange(next.id);
  };

  onMount(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          "input, textarea, select, button, [contenteditable=true], [role=radio], [role=combobox]",
        )
      ) {
        return;
      }
      if (event.key === "ArrowLeft") cycle(-1);
      if (event.key === "ArrowRight") cycle(1);
    };
    window.addEventListener("keydown", keydown);
    onCleanup(() => window.removeEventListener("keydown", keydown));
  });

  const current = () => variants.find((variant) => variant.id === props.current());
  return (
    <div class="fixed bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+5.5rem)] left-1/2 z-40 flex -translate-x-1/2 items-center rounded-full bg-neutral-950 p-1 text-neutral-50 shadow-lg shadow-neutral-950/20">
      <button
        type="button"
        class="grid size-10 place-items-center rounded-full outline-none hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-50"
        aria-label="Өмнөх хувилбар"
        onClick={() => cycle(-1)}
      >
        <ArrowLeft class="size-4" />
      </button>
      <span class="min-w-40 px-3 text-center text-xs font-medium tabular-nums">
        {current()?.id} · {current()?.label}
      </span>
      <button
        type="button"
        class="grid size-10 place-items-center rounded-full outline-none hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-50"
        aria-label="Дараагийн хувилбар"
        onClick={() => cycle(1)}
      >
        <ArrowRight class="size-4" />
      </button>
    </div>
  );
};
