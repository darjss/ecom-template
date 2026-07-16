import {
  Close,
  type CloseProps,
  Content,
  type ContentProps,
  Description,
  type DescriptionProps,
  type DynamicProps,
  Label,
  type LabelProps,
  Overlay,
  type OverlayProps,
  Portal,
  Root,
  type RootProps,
  Trigger,
  type TriggerProps,
  useContext,
} from "@corvu/drawer";
import { splitProps, type ComponentProps } from "solid-js";
import { cn } from "../lib/utils";

export const Drawer = (props: DynamicProps<"div", RootProps>) => (
  <Root data-slot="drawer" {...props} />
);
export const DrawerTrigger = (props: DynamicProps<"button", TriggerProps>) => (
  <Trigger data-slot="drawer-trigger" {...props} />
);
export const DrawerClose = (props: DynamicProps<"button", CloseProps>) => (
  <Close data-slot="drawer-close" {...props} />
);

export const DrawerOverlay = (props: DynamicProps<"div", OverlayProps>) => {
  const [local, others] = splitProps(props, ["class"]);
  const context = useContext();
  return (
    <Overlay
      data-slot="drawer-overlay"
      class={cn("fixed inset-0 z-50", local.class)}
      style={{
        "background-color": `rgb(0 0 0 / ${0.1 * context.openPercentage()})`,
        "backdrop-filter": `blur(${4 * context.openPercentage()}px)`,
      }}
      {...others}
    />
  );
};

export const DrawerContent = (props: DynamicProps<"div", ContentProps>) => {
  const [local, others] = splitProps(props, ["class", "children"]);
  return (
    <Portal>
      <DrawerOverlay />
      <Content data-slot="drawer-content" class={cn("fixed z-50", local.class)} {...others}>
        {local.children}
      </Content>
    </Portal>
  );
};

export const DrawerHeader = (props: ComponentProps<"div">) => {
  const [local, others] = splitProps(props, ["class"]);
  return <div class={cn("flex flex-col", local.class)} {...others} />;
};

export const DrawerFooter = (props: ComponentProps<"div">) => {
  const [local, others] = splitProps(props, ["class"]);
  return <div class={cn("mt-auto flex flex-col", local.class)} {...others} />;
};

export const DrawerTitle = (props: DynamicProps<"h2", LabelProps>) => {
  const [local, others] = splitProps(props, ["class"]);
  return <Label class={cn("font-semibold", local.class)} {...others} />;
};

export const DrawerDescription = (props: DynamicProps<"p", DescriptionProps>) => {
  const [local, others] = splitProps(props, ["class"]);
  return <Description class={cn("text-sm", local.class)} {...others} />;
};
