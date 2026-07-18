import {
  cmsMutationOptions,
  cmsQueryOptions,
  commerceSettingsMutationOptions,
  commerceSettingsQueryOptions,
} from "@ecom/client";
import {
  createLocationId,
  createPolicyId,
  type CmsDocument,
  type CmsDocumentKind,
} from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createSignal, For, Show } from "solid-js";

const fieldClass =
  "min-h-11 w-full rounded-lg border border-black/25 bg-(--paper) px-3 text-base text-(--ink) focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const labelClass = "grid gap-1.5 text-sm font-bold text-(--ink)";

const CmsActions = (props: { document: () => CmsDocument }) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => cmsMutationOptions(queryClient));
  const [message, setMessage] = createSignal("");
  const save = async () => {
    const result = await mutation.mutateAsync({ kind: "save-draft", document: props.document() });
    setMessage(
      result.data.cache === "not_required" ? "Ноорог хадгалагдлаа." : "Ноорог хадгалагдлаа.",
    );
  };
  const publish = async () => {
    const result = await mutation.mutateAsync({
      kind: "publish",
      documentKind: props.document().kind,
    });
    setMessage(
      result.data.cache === "purged"
        ? "Нийтлэгдэж, дэлгүүрийн кэш шинэчлэгдлээ."
        : "Нийтлэгдсэн боловч кэш цэвэрлэгдээгүй. Дахин оролдоно уу.",
    );
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

const NavigationForm = (props: {
  initial: Extract<CmsDocument, { kind: "navigation" }> | undefined;
}) => {
  const initialLabel = props.initial?.content.primary.at(0)?.label ?? "Дэлгүүр";
  const form = createForm(() => ({ defaultValues: { label: initialLabel } }));
  const document = () => ({
    kind: "navigation" as const,
    content: {
      version: 1 as const,
      primary: [
        {
          id: crypto.randomUUID(),
          label: form.state.values.label,
          enabled: true,
          destination: { kind: "home" as const },
          children: [],
        },
      ],
      footer: [],
    },
  });
  return (
    <form class="grid max-w-2xl gap-4" onSubmit={(event) => event.preventDefault()}>
      <form.Field name="label">
        {(field) => (
          <label class={labelClass}>
            Нүүр хуудасны цэсийн нэр
            <input
              class={fieldClass}
              maxlength="60"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <p class="m-0 text-sm text-(--muted)">
        Цэс хоёр түвшнээс хэтрэхгүй бөгөөд дотоод холбоос нийтлэгдсэн контент руу л заана.
      </p>
      <CmsActions document={document} />
    </form>
  );
};

const LocationsForm = (props: {
  initial: Extract<CmsDocument, { kind: "locations" }> | undefined;
}) => {
  const existing = props.initial?.content.locations.at(0);
  const form = createForm(() => ({
    defaultValues: {
      id: existing?.id ?? createLocationId(),
      name: existing?.name ?? "Өрнүүн 48 салбар",
      address: existing?.address ?? "Улаанбаатар хот",
      openingHours: existing?.openingHours ?? "Өдөр бүр 09:00–21:00",
      phone: existing?.phone ?? null,
      active: existing?.active ?? true,
      pickupEnabled: existing?.pickupEnabled ?? true,
    },
  }));
  const document = () => ({
    kind: "locations" as const,
    content: { version: 1 as const, locations: [{ ...form.state.values, directionsUrl: null }] },
  });
  return (
    <form class="grid max-w-2xl gap-4" onSubmit={(event) => event.preventDefault()}>
      <form.Field name="name">
        {(field) => (
          <label class={labelClass}>
            Байршлын нэр
            <input
              class={fieldClass}
              maxlength="80"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="address">
        {(field) => (
          <label class={labelClass}>
            Хаяг
            <textarea
              class={`${fieldClass} min-h-20 py-3`}
              maxlength="240"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="openingHours">
        {(field) => (
          <label class={labelClass}>
            Ажиллах цаг
            <input
              class={fieldClass}
              maxlength="240"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <div class="flex flex-wrap gap-6">
        <form.Field name="active">
          {(field) => (
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                checked={field().state.value}
                onChange={(event) => field().handleChange(event.currentTarget.checked)}
              />
              Нийтэд харагдана
            </label>
          )}
        </form.Field>
        <form.Field name="pickupEnabled">
          {(field) => (
            <label class="flex items-center gap-2">
              <input
                type="checkbox"
                checked={field().state.value}
                onChange={(event) => field().handleChange(event.currentTarget.checked)}
              />
              Очиж авах боломжтой
            </label>
          )}
        </form.Field>
      </div>
      <CmsActions document={document} />
    </form>
  );
};

const PoliciesForm = (props: {
  initial: Extract<CmsDocument, { kind: "policies" }> | undefined;
}) => {
  const existing = props.initial?.content.policies.find(({ kind }) => kind === "delivery");
  const form = createForm(() => ({
    defaultValues: {
      id: existing?.id ?? createPolicyId(),
      title: existing?.title ?? "Хүргэлтийн бодлого",
      contentMarkdown:
        existing?.contentMarkdown ?? "## Хүргэлт\n\nЗахиалгын хүргэлтийн нөхцөлийг энд бичнэ.",
    },
  }));
  const document = () => ({
    kind: "policies" as const,
    content: {
      version: 1 as const,
      policies: [{ ...form.state.values, kind: "delivery" as const }],
    },
  });
  return (
    <form class="grid max-w-2xl gap-4" onSubmit={(event) => event.preventDefault()}>
      <form.Field name="title">
        {(field) => (
          <label class={labelClass}>
            Бодлогын гарчиг
            <input
              class={fieldClass}
              maxlength="100"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="contentMarkdown">
        {(field) => (
          <label class={labelClass}>
            Агуулга (Markdown)
            <textarea
              class={`${fieldClass} min-h-56 py-3 font-mono`}
              maxlength="20000"
              value={field().state.value}
              onInput={(event) => field().handleChange(event.currentTarget.value)}
            />
            <span class="font-normal text-(--muted)">
              Гарчиг, жагсаалт, тод, налуу, эшлэл болон аюулгүй холбоос дэмжинэ. HTML болон зураг
              хориглоно.
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
    <Show when={query.data?.data} fallback={<p role="status">Тохиргоо ачаалж байна…</p>}>
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
  { kind: "navigation", label: "Цэс" },
  { kind: "locations", label: "Байршил" },
  { kind: "policies", label: "Бодлого" },
  { kind: "settings", label: "Худалдааны тохиргоо" },
];
export const CmsManagement = () => {
  const query = useQuery(() => cmsQueryOptions());
  const [active, setActive] =
    createSignal<(typeof sections)[number]["kind"]>("storefront_identity");
  const document = (kind: CmsDocumentKind) => query.data?.data.find((entry) => entry.kind === kind);
  const identity = () => {
    const value = document("storefront_identity");
    return value?.kind === "storefront_identity" ? value : undefined;
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
  return (
    <section class="border-t border-black/15 py-10" aria-labelledby="cms-title">
      <h2 id="cms-title" class="m-0 text-2xl font-bold">
        Дэлгүүрийн агуулга
      </h2>
      <p class="mt-2 max-w-prose text-(--muted)">
        Ноорог нь нийтэд харагдахгүй. Нийтэлсний дараа Store-ийн SSR хуудас шууд шинэчлэгдэнэ.
      </p>
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
      <Show when={!query.isPending} fallback={<p role="status">Агуулга ачаалж байна…</p>}>
        <Show when={active() === "storefront_identity"}>
          <IdentityForm initial={identity()} />
        </Show>
        <Show when={active() === "navigation"}>
          <NavigationForm initial={navigation()} />
        </Show>
        <Show when={active() === "locations"}>
          <LocationsForm initial={locations()} />
        </Show>
        <Show when={active() === "policies"}>
          <PoliciesForm initial={policies()} />
        </Show>
        <Show when={active() === "settings"}>
          <SettingsForm />
        </Show>
      </Show>
    </section>
  );
};
