import CircleCheck from "lucide-solid/icons/circle-check";
import Info from "lucide-solid/icons/info";
import LoaderCircle from "lucide-solid/icons/loader-circle";
import OctagonX from "lucide-solid/icons/octagon-x";
import TriangleAlert from "lucide-solid/icons/triangle-alert";
import type { Component, ComponentProps, JSX } from "solid-js";
import { Toaster as Sonner } from "solid-sonner";
import { useColorMode } from "@/components/color-mode";

type ToasterProps = ComponentProps<typeof Sonner>;

const Toaster: Component<ToasterProps> = (props) => {
  const { colorMode } = useColorMode();
  return (
    <Sonner
      theme={colorMode()}
      class="toaster group"
      position="top-center"
      icons={{
        success: <CircleCheck class="size-4" />,
        info: <Info class="size-4" />,
        warning: <TriangleAlert class="size-4" />,
        error: <OctagonX class="size-4" />,
        loading: <LoaderCircle class="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as JSX.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
