import {
  cmsCachePurgeMutationOptions,
  cmsMutationOptions,
  cmsQueryOptions,
  commerceSettingsMutationOptions,
  commerceSettingsQueryOptions,
} from "@ecom/client";
import {
  createLocationId,
  createPolicyId,
  LocationsDocumentSchema,
  NavigationDocumentSchema,
  PoliciesDocumentSchema,
  type CmsDocument,
  type CmsDocumentKind,
} from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createSignal, For, Show } from "solid-js";
import * as v from "valibot";
import { AnnouncementEditor, HomepageEditor, OrderingNoticesEditor } from "./ContentDraftEditors";

const fieldClass =
  "min-h-11 w-full rounded-lg border border-black/25 bg-(--paper) px-3 text-base text-(--ink) focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const labelClass = "grid gap-1.5 text-sm font-bold text-(--ink)";

const CmsActions = (props: { document: () => CmsDocument }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => cmsMutationOptions(queryClient));
  const [message, setMessage] = createSignal("");
  const save = async () => {
    try {
      await mutation.mutateAsync({ kind: "save-draft", document: props.document() });
      setMessage("Ноорог хадгалагдлаа.");
    } catch {
      setMessage("Document JSON болон талбарын утгуудыг шалгана уу.");
    }
  };
  const publish = async () => {
    try {
      const result = await mutation.mutateAsync({
        kind: "publish",
        documentKind: props.document().kind,
      });
      setMessage(
        result.data.cache === "purged"
          ? "Нийтлэгдэж, дэлгүүрийн кэш шинэчлэгдлээ."
          : "Нийтлэгдсэн боловч кэш цэвэрлэгдээгүй. Дахин оролдоно уу.",
      );
    } catch {
      setMessage("Нийтлэхийн өмнө document JSON болон талбарын утгуудыг шалгана уу.");
    }
  };
  return (
    <div class="flex flex-wrap items-center gap-3">
      <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={save}>
        Ноорог хадгалах
      </Button>
      <Button type="button" disabled={mutation.isPending} onClick={publish}>
        Нийтлэх
      </Button>
      <Show when={mutation.error}>
        <p class="m-0 text-sm text-red-800" role="alert">
          Хадгалж чадсангүй. Талбар болон холбоосоо шалгана уу.
        </p>
      </Show>
      <Show when={message()}>
        {(value) => (
          <p class="m-0 text-sm" role="status">
            {value()}
          </p>
        )}
      </Show>
    </div>
  );
};

const IdentityForm = (props: {
  initial: Extract<CmsDocument, { kind: "storefront_identity" }> | undefined;
}) => {
  const form = createForm(() => ({
    defaultValues: props.initial?.content ?? {
      version: 1 as const,
      displayName: "Өрнүүн 48",
      legalName: null,
      tagline: "Өдөр бүрийн хэрэгцээг цэгцтэй",
      summary: "Хүнс, гэр ахуй, жижиг бэлгийн сонголт.",
      logoMediaAssetId: null,
      faviconMediaAssetId: null,
      publicPhone: null,
      publicEmail: null,
      socialLinks: [],
    },
  }));
  const document = () => ({ kind: "storefront_identity" as const, content: form.state.values });
  return (
    <form class="grid max-w-2xl gap-4" onSubmit={(event) => event.preventDefault()}>
      <form.Field name="displayName">
        {(field) => (
          <label class={labelClass}>
            Дэлгүүрийн нэр
            <input
              class={fieldClass}
              maxlength="80"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="tagline">
        {(field) => (
          <label class={labelClass}>
            Уриа
            <input
              class={fieldClass}
              maxlength="120"
              value={field().state.value ?? ""}
              onInput={(event) => field().handleChange(event.currentTarget.value || null)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="summary">
        {(field) => (
          <label class={labelClass}>
            Товч тайлбар
            <textarea
              class={`${fieldClass} min-h-24 py-3`}
              maxlength="320"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <div class="grid gap-4 sm:grid-cols-2">
        <form.Field name="publicPhone">
          {(field) => (
            <label class={labelClass}>
              Нийтийн утас
              <input
                class={fieldClass}
                maxlength="32"
                value={field().state.value ?? ""}
                onInput={(event) => field().handleChange(event.currentTarget.value || null)}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="publicEmail">
          {(field) => (
            <label class={labelClass}>
              Нийтийн и-мэйл
              <input
                class={fieldClass}
                type="email"
                value={field().state.value ?? ""}
                onInput={(event) => field().handleChange(event.currentTarget.value || null)}
              />
            </label>
          )}
        </form.Field>
      </div>
      <CmsActions document={document} />
    </form>
  );
};

const FullCmsDocumentForm = (props: {
  document: Extract<CmsDocument, { kind: "navigation" | "locations" | "policies" }>;
  label: string;
}) => {
  const form = createForm(() => ({
    defaultValues: { contentJson: JSON.stringify(props.document.content, null, 2) },
  }));
  const document = (): CmsDocument => {
    const content: unknown = JSON.parse(form.state.values.contentJson);
    switch (props.document.kind) {
      case "navigation":
        return { kind: props.document.kind, content: v.parse(NavigationDocumentSchema, content) };
      case "locations":
        return { kind: props.document.kind, content: v.parse(LocationsDocumentSchema, content) };
      case "policies":
        return { kind: props.document.kind, content: v.parse(PoliciesDocumentSchema, content) };
    }
  };
  return (
    <form class="grid max-w-3xl gap-4" onSubmit={(event) => event.preventDefault()}>
      <form.Field name="contentJson">
        {(field) => (
          <label class={labelClass}>
            {props.label}
            <textarea
              class={`${fieldClass} min-h-96 py-3 font-mono text-sm`}
              spellcheck={false}
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
            <span class="font-normal text-(--muted)">
              Энэ нь нэг бүтэн, хатуу схемтэй document. ID, бүх түвшний цэс, footer, чиглүүлэх
              холбоос, Location болон Policy бүрийг хамтад нь хадгална.
            </span>
          </label>
        )}
      </form.Field>
      <CmsActions document={document} />
    </form>
  );
};

const settingToggles = [
  ["bankTransferEnabled", "Банкны шилжүүлэг"],
  ["cashOnDeliveryEnabled", "Хүргэлтээр бэлэн төлөх"],
  ["customerAccountsEnabled", "Хэрэглэгчийн бүртгэл"],
  ["telegramEnabled", "Telegram оператор"],
  ["pickupEnabled", "Очиж авах"],
  ["deliveryEnabled", "Хүргэлт"],
] as const;

const SettingsForm = () => {
  const queryClient = useQueryClient();
  const query = useQuery(() => commerceSettingsQueryOptions());
  const mutation = useMutation(() => commerceSettingsMutationOptions(queryClient));
  return (
    <Show
      when={query.data?.data}
      fallback={
        query.isError ? (
          <div class="grid justify-items-start gap-3">
            <p class="m-0 text-red-800" role="alert">
              Худалдааны тохиргоог ачаалж чадсангүй.
            </p>
            <Button type="button" variant="secondary" onClick={() => query.refetch()}>
              Дахин ачаалах
            </Button>
          </div>
        ) : (
          <p role="status">Тохиргоо ачаалж байна…</p>
        )
      }
    >
      {(settings) => {
        const form = createForm(() => ({ defaultValues: settings() }));
        return (
          <form
            class="grid max-w-2xl gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              await mutation.mutateAsync(form.state.values);
            }}
          >
            <div class="grid gap-3 sm:grid-cols-2">
              <For each={settingToggles}>
                {([name, label]) => (
                  <form.Field name={name}>
                    {(field) => (
                      <label class="flex min-h-11 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={field().state.value}
                          onChange={(event) => field().handleChange(event.currentTarget.checked)}
                        />
                        {label}
                      </label>
                    )}
                  </form.Field>
                )}
              </For>
            </div>
            <form.Field name="deliveryFeeMnt">
              {(field) => (
                <label class={labelClass}>
                  Хүргэлтийн төлбөр (₮)
                  <input
                    class={fieldClass}
                    type="number"
                    min="0"
                    max="10000000"
                    value={field().state.value}
                    onInput={(event) => field().handleChange(event.currentTarget.valueAsNumber)}
                  />
                </label>
              )}
            </form.Field>
            <form.Field name="freeDeliveryThresholdMnt">
              {(field) => (
                <label class={labelClass}>
                  Үнэгүй хүргэлтийн босго (₮)
                  <input
                    class={fieldClass}
                    type="number"
                    min="0"
                    max="1000000000"
                    value={field().state.value ?? ""}
                    onInput={(event) =>
                      field().handleChange(
                        Number.isNaN(event.currentTarget.valueAsNumber)
                          ? null
                          : event.currentTarget.valueAsNumber,
                      )
                    }
                  />
                </label>
              )}
            </form.Field>
            <Button class="w-fit" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Хадгалж байна…" : "Тохиргоо хадгалах"}
            </Button>
            <Show when={mutation.data}>
              {(result) => (
                <p class="m-0 text-sm" role="status">
                  {result().data.cache === "purged"
                    ? "Тохиргоо нийтлэгдэж, кэш шинэчлэгдлээ."
                    : "Тохиргоо хадгалагдсан боловч кэш цэвэрлэгдээгүй."}
                </p>
              )}
            </Show>
            <Show when={mutation.error}>
              <p class="m-0 text-sm text-red-800" role="alert">
                Тохиргоо хадгалж чадсангүй. Боломжийн хязгаар болон утгуудыг шалгана уу.
              </p>
            </Show>
          </form>
        );
      }}
    </Show>
  );
};

const sections: readonly { kind: CmsDocumentKind | "settings"; label: string }[] = [
  { kind: "storefront_identity", label: "Нэр ба холбоо" },
  { kind: "homepage", label: "Нүүр хуудас" },
  { kind: "announcement", label: "Мэдэгдэл" },
  { kind: "ordering_notices", label: "Захиалгын мэдээлэл" },
  { kind: "navigation", label: "Цэс" },
  { kind: "locations", label: "Байршил" },
  { kind: "policies", label: "Бодлого" },
  { kind: "settings", label: "Худалдааны тохиргоо" },
];
export const CmsManagement = (props: { store: string }) => {
  const query = useQuery(() => cmsQueryOptions());
  const cachePurge = useMutation(() => cmsCachePurgeMutationOptions());
  const [active, setActive] =
    createSignal<(typeof sections)[number]["kind"]>("storefront_identity");
  const document = (kind: CmsDocumentKind) => query.data?.data.find((entry) => entry.kind === kind);
  const identity = () => {
    const value = document("storefront_identity");
    return value?.kind === "storefront_identity" ? value : undefined;
  };
  const homepage = () => {
    const value = document("homepage");
    return value?.kind === "homepage" ? value : undefined;
  };
  const announcement = () => {
    const value = document("announcement");
    return value?.kind === "announcement" ? value : undefined;
  };
  const orderingNotices = () => {
    const value = document("ordering_notices");
    return value?.kind === "ordering_notices" ? value : undefined;
  };
  const navigation = () => {
    const value = document("navigation");
    return value?.kind === "navigation" ? value : undefined;
  };
  const locations = () => {
    const value = document("locations");
    return value?.kind === "locations" ? value : undefined;
  };
  const policies = () => {
    const value = document("policies");
    return value?.kind === "policies" ? value : undefined;
  };
  const emptyHomepage: Extract<CmsDocument, { kind: "homepage" }> = {
    kind: "homepage",
    content: {
      version: 1,
      headline: "Гэрийн тавиур.",
      summary: "Хүнс, цэвэрлэгээ, жижиг бэлгийг нэг тавиураас ойлгомжтой сонгоорой.",
      hero: null,
      featuredCatalogItemIds: [],
    },
  };
  const emptyAnnouncement: Extract<CmsDocument, { kind: "announcement" }> = {
    kind: "announcement",
    content: {
      version: 1,
      enabled: false,
      message: "Дэлгүүрийн мэдэгдэл",
      emphasis: "neutral",
      link: null,
    },
  };
  const emptyOrderingNotices: Extract<CmsDocument, { kind: "ordering_notices" }> = {
    kind: "ordering_notices",
    content: { version: 1, notices: [] },
  };
  const emptyNavigation: Extract<CmsDocument, { kind: "navigation" }> = {
    kind: "navigation",
    content: {
      version: 1,
      primary: [
        {
          id: crypto.randomUUID(),
          label: "Дэлгүүр",
          enabled: true,
          destination: { kind: "home" },
          children: [],
        },
      ],
      footer: [],
    },
  };
  const emptyLocations: Extract<CmsDocument, { kind: "locations" }> = {
    kind: "locations",
    content: {
      version: 1,
      locations: [
        {
          id: createLocationId(),
          name: "Өрнүүн 48 салбар",
          address: "Улаанбаатар хот",
          phone: null,
          openingHours: "Өдөр бүр 09:00–21:00",
          directionsUrl: null,
          active: true,
          pickupEnabled: true,
        },
      ],
    },
  };
  const emptyPolicies: Extract<CmsDocument, { kind: "policies" }> = {
    kind: "policies",
    content: {
      version: 1,
      policies: [
        {
          id: createPolicyId(),
          kind: "delivery",
          title: "Хүргэлтийн бодлого",
          contentMarkdown: "## Хүргэлт\n\nЗахиалгын хүргэлтийн нөхцөлийг энд бичнэ.",
        },
      ],
    },
  };
  return (
    <section class="border-t border-black/15 py-10" aria-labelledby="cms-title">
      <h2 id="cms-title" class="m-0 text-2xl font-bold">
        Дэлгүүрийн агуулга
      </h2>
      <p class="mt-2 max-w-prose text-(--muted)">
        Ноорог нь нийтэд харагдахгүй. Нийтэлсний дараа Store-ийн SSR хуудас шууд шинэчлэгдэнэ.
      </p>
      <div class="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={cachePurge.isPending}
          onClick={() => cachePurge.mutate()}
        >
          {cachePurge.isPending ? "Кэш цэвэрлэж байна…" : "Кэш цэвэрлэгээг дахин оролдох"}
        </Button>
        <Show when={cachePurge.data}>
          {(result) => (
            <p class="m-0 text-sm" role="status">
              {result().data.cache === "purged"
                ? "Дэлгүүрийн кэш шинэчлэгдлээ."
                : result().data.cache === "not_required"
                  ? "Хүлээгдэж буй кэш цэвэрлэгээ алга."
                  : "Кэш цэвэрлэгдээгүй. Дахин оролдоно уу."}
            </p>
          )}
        </Show>
        <Show when={cachePurge.error}>
          <p class="m-0 text-sm text-red-800" role="alert">
            Кэш цэвэрлэгээг дахин эхлүүлж чадсангүй.
          </p>
        </Show>
      </div>
      <div
        class="my-6 flex max-w-full gap-2 overflow-x-auto pb-2"
        role="tablist"
        aria-label="Агуулгын төрөл"
      >
        <For each={sections}>
          {(section) => (
            <button
              class="min-h-11 shrink-0 rounded-lg border border-black/20 px-3 font-bold aria-selected:bg-(--ink) aria-selected:text-white"
              type="button"
              role="tab"
              aria-selected={active() === section.kind}
              onClick={() => setActive(section.kind)}
            >
              {section.label}
            </button>
          )}
        </For>
      </div>
      <Show
        when={query.isSuccess}
        fallback={
          query.isPending ? (
            <p role="status">Агуулга ачаалж байна…</p>
          ) : (
            <div class="grid justify-items-start gap-3">
              <p class="m-0 text-red-800" role="alert">
                Агуулгыг ачаалж чадсангүй. Өгөгдөл сэргээгдэх хүртэл засварлах боломжгүй.
              </p>
              <Button type="button" variant="secondary" onClick={() => query.refetch()}>
                Дахин ачаалах
              </Button>
            </div>
          )
        }
      >
        <Show when={active() === "storefront_identity"}>
          <IdentityForm initial={identity()} />
        </Show>
        <Show when={active() === "homepage"}>
          <HomepageEditor store={props.store} initial={homepage() ?? emptyHomepage} />
        </Show>
        <Show when={active() === "announcement"}>
          <AnnouncementEditor store={props.store} initial={announcement() ?? emptyAnnouncement} />
        </Show>
        <Show when={active() === "ordering_notices"}>
          <OrderingNoticesEditor
            store={props.store}
            initial={orderingNotices() ?? emptyOrderingNotices}
          />
        </Show>
        <Show when={active() === "navigation"}>
          <FullCmsDocumentForm
            document={navigation() ?? emptyNavigation}
            label="Бүрэн Navigation document"
          />
        </Show>
        <Show when={active() === "locations"}>
          <FullCmsDocumentForm
            document={locations() ?? emptyLocations}
            label="Бүрэн Locations document"
          />
        </Show>
        <Show when={active() === "policies"}>
          <FullCmsDocumentForm
            document={policies() ?? emptyPolicies}
            label="Бүрэн Policies document"
          />
        </Show>
        <Show when={active() === "settings"}>
          <SettingsForm />
        </Show>
      </Show>
    </section>
  );
};
