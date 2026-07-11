import { createSignal } from "solid-js";
import { createMerchantForm } from "./create-merchant-form";
import {
  productDescriptors,
  productIdentity,
  productSchema,
  type ProductValues,
} from "./product-model";
import { createScenarioLab } from "./scenario-lab";

export type ProductSection = "basics" | "story" | "publishing";
export type ProductView = "editor" | "preview";

const sectionForField: Record<keyof ProductValues, ProductSection> = {
  name: "basics",
  price: "basics",
  category: "basics",
  description: "story",
  published: "publishing",
};

export const createProductEditorController = () => {
  const scenario = createScenarioLab();
  const [section, setSection] = createSignal<ProductSection>("basics");
  const [view, setView] = createSignal<ProductView>("editor");
  const merchant = createMerchantForm({
    identity: productIdentity,
    schemaVersion: "product-summary-v1",
    schema: productSchema,
    initialRecord: scenario.serverRecord(),
    descriptors: productDescriptors,
    fieldIds: ["name", "price", "category", "description", "published"],
    onInvalidField: (fieldId) => {
      setView("editor");
      setSection(sectionForField[fieldId]);
    },
    save: scenario.save,
  });

  return { merchant, scenario, section, setSection, view, setView };
};

export type ProductEditorController = ReturnType<typeof createProductEditorController>;
