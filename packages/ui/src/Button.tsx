import type { JSX } from "solid-js";

export type ButtonProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly tone?: "primary" | "quiet";
};

export const Button = (props: ButtonProps) => {
  let button: HTMLButtonElement | undefined;
  const tone = () => props.tone ?? "primary";
  const press = async () => {
    if (button && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const { animate } = await import("motion");
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
