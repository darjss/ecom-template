import { animate } from "motion";
import type { JSX } from "solid-js";

export type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly tone?: "primary" | "quiet";
};

export const Button = (props: ButtonProps) => {
  let button: HTMLButtonElement | undefined;
  const tone = () => props.tone ?? "primary";
  const press = () => {
    if (button && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      animate(button, { scale: [1, 0.97, 1] }, { duration: 0.18, ease: "easeOut" });
    }
  };
  return (
    <button
      {...props}
      ref={(element) => {
        button = element;
      }}
      class={`ui-button ui-button--${tone()} ${props.class ?? ""}`}
      onPointerDown={press}
    >
      {props.children}
    </button>
  );
};
