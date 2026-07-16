import { type ButtonRootProps, Root } from "@kobalte/core/button";
import type { PolymorphicProps } from "@kobalte/core/polymorphic";
import { cva, type VariantProps } from "class-variance-authority";
import { splitProps } from "solid-js";
import { cn } from "../lib/utils";

export const buttonVariants = cva("ui-button", {
  variants: {
    variant: {
      default: "ui-button--primary",
      secondary: "ui-button--quiet",
    },
  },
  defaultVariants: { variant: "default" },
});

export type ButtonProps = PolymorphicProps<"button", ButtonRootProps<"button">> &
  VariantProps<typeof buttonVariants>;

export const Button = (props: ButtonProps) => {
  let button: HTMLButtonElement | undefined;
  const [local, others] = splitProps(props, ["variant", "class"]);
  const press = async () => {
    if (button && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const { animate } = await import("motion");
      animate(button, { scale: [1, 0.97, 1] }, { duration: 0.18, ease: "easeOut" });
    }
  };
  return (
    <Root
      ref={(element) => {
        button = element;
      }}
      onPointerDown={press}
      class={cn(buttonVariants({ variant: local.variant }), local.class)}
      data-slot="button"
      {...others}
    />
  );
};
