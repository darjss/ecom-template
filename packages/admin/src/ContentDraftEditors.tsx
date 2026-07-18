import { bundleQueryOptions, catalogQueryOptions, cmsMutationOptions } from "@ecom/client";
import {
  AnnouncementDocumentSchema,
  HomepageDocumentSchema,
  OrderingNoticesDocumentSchema,
  type CmsDocument,
} from "@ecom/contracts";
import { Button } from "@ecom/ui";
import { makePersisted } from "@solid-primitives/storage";
import { createForm } from "@tanstack/solid-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createEffect, createSignal, For, Index, on, Show, type Signal } from "solid-js";
import * as v from "valibot";

const fieldClass =
  "min-h-11 w-full rounded-lg border border-black/25 bg-(--paper) px-3 text-base text-(--ink) focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-60";
const labelClass = "grid gap-1.5 text-sm font-bold text-(--ink)";
type ContentDocument = Extract<
  CmsDocument,
  { kind: "homepage" | "announcement" | "ordering_notices" }
>;
type DraftIssue = "malformed" | "incompatible";

const LocalContentDraftSchema = v.variant("kind", [
  v.strictObject({
    store: v.string(),
    kind: v.literal("homepage"),
    schemaVersion: v.literal(1),
    content: HomepageDocumentSchema,
  }),
  v.strictObject({
    store: v.string(),
    kind: v.literal("announcement"),
    schemaVersion: v.literal(1),
    content: AnnouncementDocumentSchema,
  }),
  v.strictObject({
    store: v.string(),
    kind: v.literal("ordering_notices"),
    schemaVersion: v.literal(1),
    content: OrderingNoticesDocumentSchema,
  }),
]);

const createLocalDraft = (readStore: () => string, initial: ContentDocument) => {
  const [issue, setIssue] = createSignal<DraftIssue>();
  const store = readStore();
  const key = `ecom:cms:${store}:${initial.kind}:v1`;
  const [localDraft, setLocalDraft] = createSignal<ContentDocument | null>(null);
  const localSignal: Signal<ContentDocument | null> = [localDraft, setLocalDraft];
  const [draft, setDraft] = makePersisted<ContentDocument | null, typeof localSignal>(localSignal, {
    name: key,
    deserialize: (serialized) => {
      let value: unknown;
      try {
        value = JSON.parse(serialized);
      } catch {
        setIssue("malformed");
        throw new Error("Malformed local CMS draft");
      }
      if (
        value !== null &&
        typeof value === "object" &&
        Object.hasOwn(value, "schemaVersion") &&
        Reflect.get(value, "schemaVersion") !== 1
      ) {
        setIssue("incompatible");
        throw new Error("Incompatible local CMS draft");
      }
      const parsed = v.safeParse(LocalContentDraftSchema, value);
      if (!parsed.success || parsed.output.store !== store || parsed.output.kind !== initial.kind) {
        setIssue("malformed");
        throw new Error("Invalid local CMS draft");
      }
      switch (parsed.output.kind) {
        case "homepage":
          return { kind: "homepage", content: parsed.output.content };
        case "announcement":
          return { kind: "announcement", content: parsed.output.content };
        case "ordering_notices":
          return { kind: "ordering_notices", content: parsed.output.content };
      }
    },
    serialize: (document) =>
      JSON.stringify({
        store,
        kind: document?.kind,
        schemaVersion: 1,
        content: document?.content,
      }),
  });
  const compatible = () => {
    const value = draft();
    return value?.kind === initial.kind ? value : initial;
  };
  const discard = () => {
    setDraft(null);
    setIssue(undefined);
  };
  return { compatible, issue, setDraft, discard };
};

const DraftRecovery = (props: { issue: () => DraftIssue | undefined; discard: () => void }) => (
  <Show when={props.issue()}>
    {(issue) => (
      <div
        class="grid max-w-2xl justify-items-start gap-3 rounded-lg border border-amber-700/40 bg-amber-50 p-4 text-amber-950"
        role="alert"
      >
        <strong>
          {issue() === "incompatible"
            ? "Өөр schema хувилбарын local ноорог олдлоо."
            : "Local ноорог гэмтсэн эсвэл энэ Store-д тохирохгүй байна."}
        </strong>
        <p class="m-0 text-sm">
          Серверийн агуулгыг дарж бичээгүй. Local хуулбарыг устгасны дараа серверийн утгаас
          үргэлжлүүлнэ.
        </p>
        <Button type="button" variant="secondary" onClick={() => props.discard()}>
          Local хуулбарыг устгаад сэргээх
        </Button>
      </div>
    )}
  </Show>
);

const ContentActions = (props: {
  document: () => ContentDocument;
  documentKind: ContentDocument["kind"];
  clearLocal: () => void;
}) => {
  const queryClient = useQueryClient();
  const mutation = useMutation(() => cmsMutationOptions(queryClient));
  const [message, setMessage] = createSignal("");
  const save = async () => {
    try {
      await mutation.mutateAsync({ kind: "save-draft", document: props.document() });
      props.clearLocal();
      setMessage("Ноорог серверт хадгалагдаж, local хуулбар цэвэрлэгдлээ.");
    } catch {
      setMessage("Хадгалахын өмнө бүх талбарыг шалгана уу.");
    }
  };
  const publish = async () => {
    try {
      const document = props.document();
      await mutation.mutateAsync({ kind: "save-draft", document });
      const result = await mutation.mutateAsync({
        kind: "publish",
        documentKind: document.kind,
      });
      props.clearLocal();
      setMessage(
        result.data.cache === "purged"
          ? "Нийтлэгдэж, дэлгүүрийн кэш шинэчлэгдлээ."
          : "Нийтлэгдсэн боловч кэш цэвэрлэгдээгүй. Дахин оролдоно уу.",
      );
    } catch {
      setMessage("Нийтлэхийн өмнө талбар болон холбоосоо шалгана уу.");
    }
  };
  let previewInput: HTMLInputElement | undefined;
  const preparePreview = (event: SubmitEvent) => {
    try {
      if (!previewInput) {
        event.preventDefault();
        setMessage("Preview form бэлэн болсонгүй. Дахин оролдоно уу.");
        return;
      }
      previewInput.value = JSON.stringify(props.document());
    } catch {
      event.preventDefault();
      setMessage("Preview хийхийн өмнө бүх талбарыг шалгана уу.");
    }
  };
  return (
    <div class="grid gap-3 border-t border-black/15 pt-4">
      <div class="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={save}>
          Ноорог хадгалах
        </Button>
        <Button type="button" disabled={mutation.isPending} onClick={publish}>
          Нийтлэх
        </Button>
        <form
          action="/admin/content-preview"
          method="post"
          target="_blank"
          onSubmit={preparePreview}
        >
          <input ref={(element) => (previewInput = element)} type="hidden" name="document" />
          <Button type="submit" variant="secondary">
            Одоогийн утгыг preview хийх
          </Button>
        </form>
        <a
          class="rounded-lg px-3 py-2 font-bold underline"
          href={`/admin/content-preview?kind=${props.documentKind}`}
          target="_blank"
        >
          Сервер ноорог preview
        </a>
      </div>
      <Show when={message()}>
        {(value) => (
          <p class="m-0 text-sm" role="status">
            {value()}
          </p>
        )}
      </Show>
      <Show when={mutation.error}>
        <p class="m-0 text-sm text-red-800" role="alert">
          Агуулгын үйлдэл амжилтгүй боллоо.
        </p>
      </Show>
    </div>
  );
};

type EditorProps<T extends ContentDocument> = { store: string; initial: T };

export const HomepageEditor = (
  props: EditorProps<Extract<ContentDocument, { kind: "homepage" }>>,
) => {
  const local = createLocalDraft(() => props.store, props.initial);
  const compatible = local.compatible();
  const restored = compatible.kind === "homepage" ? compatible : props.initial;
  const catalog = useQuery(() => catalogQueryOptions());
  const bundles = useQuery(() => bundleQueryOptions());
  const form = createForm(() => ({
    defaultValues: {
      headline: restored.content.headline,
      summary: restored.content.summary,
      heroMediaAssetId: restored.content.hero?.mediaAssetId ?? "",
      heroAltText: restored.content.hero?.altText ?? "",
      featuredCatalogItemIds: [...restored.content.featuredCatalogItemIds],
    },
  }));
  const valuesVersion = form.useSelector((state) => JSON.stringify(state.values));
  const content = () => {
    const current = form.state.values;
    return {
      version: 1,
      headline: current.headline,
      summary: current.summary,
      hero:
        current.heroMediaAssetId === ""
          ? null
          : {
              mediaAssetId: current.heroMediaAssetId,
              altText: current.heroAltText,
            },
      featuredCatalogItemIds: current.featuredCatalogItemIds,
    };
  };
  const document = (): Extract<ContentDocument, { kind: "homepage" }> => ({
    kind: "homepage",
    content: v.parse(HomepageDocumentSchema, content()),
  });
  createEffect(
    on(
      valuesVersion,
      () => {
        if (local.issue()) {
          return;
        }
        const parsed = v.safeParse(HomepageDocumentSchema, content());
        if (parsed.success) {
          local.setDraft({ kind: "homepage", content: parsed.output });
        }
      },
      { defer: true },
    ),
  );
  const items = () => [
    ...(catalog.data?.data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      state: item.state,
      images: item.images,
    })),
    ...(bundles.data?.data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      state: item.state,
      images: item.images,
    })),
  ];
  const publishedItems = () => items().filter(({ state }) => state === "published");
  const media = () => {
    const entries = publishedItems().flatMap((item) =>
      item.images.map((image) => ({
        id: image.mediaAsset.id,
        label: `${item.name} · ${image.altText}`,
      })),
    );
    return [...new Map(entries.map((entry) => [entry.id, entry])).values()];
  };
  return (
    <div class="grid gap-4">
      <DraftRecovery issue={local.issue} discard={local.discard} />
      <fieldset class="grid max-w-3xl gap-4 border-0 p-0" disabled={Boolean(local.issue())}>
        <form.Field name="headline">
          {(field) => (
            <label class={labelClass}>
              Нүүрний гарчиг
              <input
                class={fieldClass}
                maxlength="120"
                value={field().state.value}
                onInput={(event) => field().handleChange(event.currentTarget.value)}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="summary">
          {(field) => (
            <label class={labelClass}>
              Дэмжих тайлбар
              <textarea
                class={`${fieldClass} min-h-28 py-3`}
                maxlength="320"
                value={field().state.value}
                onInput={(event) => field().handleChange(event.currentTarget.value)}
              />
            </label>
          )}
        </form.Field>
        <div class="grid gap-4 sm:grid-cols-2">
          <form.Field name="heroMediaAssetId">
            {(field) => (
              <label class={labelClass}>
                Hero зураг
                <select
                  class={fieldClass}
                  value={field().state.value}
                  onChange={(event) => field().handleChange(event.currentTarget.value)}
                >
                  <option value="" selected={field().state.value === ""}>
                    Repository-н үндсэн зураг
                  </option>
                  <For each={media()}>
                    {(image) => (
                      <option value={image.id} selected={field().state.value === image.id}>
                        {image.label}
                      </option>
                    )}
                  </For>
                </select>
              </label>
            )}
          </form.Field>
          <form.Field name="heroAltText">
            {(field) => (
              <label class={labelClass}>
                Hero зургийн тайлбар
                <input
                  class={fieldClass}
                  maxlength="240"
                  value={field().state.value}
                  onInput={(event) => field().handleChange(event.currentTarget.value)}
                />
              </label>
            )}
          </form.Field>
        </div>
        <form.Field name="featuredCatalogItemIds">
          {(field) => (
            <div class="grid gap-3">
              <span class="text-sm font-bold">Онцлох Catalog Items · дараалал хадгалагдана</span>
              <ol class="m-0 grid list-none gap-2 p-0">
                <For each={field().state.value}>
                  {(id, index) => {
                    const item = () => publishedItems().find((entry) => entry.id === id);
                    return (
                      <li class="flex flex-wrap items-center gap-2 rounded-lg border border-black/15 bg-white p-2">
                        <span class="min-w-0 flex-1 font-bold">{item()?.name ?? id}</span>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={index() === 0}
                          onClick={() => {
                            const next = [...field().state.value];
                            const previous = next[index() - 1];
                            if (previous === undefined) {
                              return;
                            }
                            next[index() - 1] = id;
                            next[index()] = previous;
                            field().handleChange(next);
                          }}
                        >
                          Дээш
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={index() === field().state.value.length - 1}
                          onClick={() => {
                            const next = [...field().state.value];
                            const following = next[index() + 1];
                            if (following === undefined) {
                              return;
                            }
                            next[index() + 1] = id;
                            next[index()] = following;
                            field().handleChange(next);
                          }}
                        >
                          Доош
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            field().handleChange(
                              field().state.value.filter((value) => value !== id),
                            )
                          }
                        >
                          Хасах
                        </Button>
                      </li>
                    );
                  }}
                </For>
              </ol>
              <label class={labelClass}>
                Catalog Item нэмэх
                <select
                  class={fieldClass}
                  value=""
                  disabled={field().state.value.length >= 12}
                  onChange={(event) => {
                    const id = event.currentTarget.value;
                    if (
                      id &&
                      field().state.value.length < 12 &&
                      !field().state.value.includes(id)
                    ) {
                      field().handleChange([...field().state.value, id]);
                    }
                    event.currentTarget.value = "";
                  }}
                >
                  <option value="">Сонгох…</option>
                  <For
                    each={publishedItems().filter(({ id }) => !field().state.value.includes(id))}
                  >
                    {(item) => <option value={item.id}>{item.name}</option>}
                  </For>
                </select>
              </label>
            </div>
          )}
        </form.Field>
        <ContentActions document={document} documentKind="homepage" clearLocal={local.discard} />
      </fieldset>
    </div>
  );
};

export const AnnouncementEditor = (
  props: EditorProps<Extract<ContentDocument, { kind: "announcement" }>>,
) => {
  const local = createLocalDraft(() => props.store, props.initial);
  const compatible = local.compatible();
  const restored = compatible.kind === "announcement" ? compatible : props.initial;
  const form = createForm(() => ({ defaultValues: { ...restored.content } }));
  const valuesVersion = form.useSelector((state) => JSON.stringify(state.values));
  const document = (): Extract<ContentDocument, { kind: "announcement" }> => ({
    kind: "announcement",
    content: v.parse(AnnouncementDocumentSchema, form.state.values),
  });
  createEffect(
    on(
      valuesVersion,
      () => {
        if (local.issue()) {
          return;
        }
        const parsed = v.safeParse(AnnouncementDocumentSchema, form.state.values);
        if (parsed.success) {
          local.setDraft({ kind: "announcement", content: parsed.output });
        }
      },
      { defer: true },
    ),
  );
  return (
    <div class="grid gap-4">
      <DraftRecovery issue={local.issue} discard={local.discard} />
      <fieldset class="grid max-w-2xl gap-4 border-0 p-0" disabled={Boolean(local.issue())}>
        <form.Field name="enabled">
          {(field) => (
            <label class="flex min-h-11 items-center gap-2 font-bold">
              <input
                type="checkbox"
                checked={field().state.value}
                onChange={(event) => field().handleChange(event.currentTarget.checked)}
              />
              Store-ийн бүх хуудсанд харуулах
            </label>
          )}
        </form.Field>
        <form.Field name="message">
          {(field) => (
            <label class={labelClass}>
              Мэдэгдэл
              <input
                class={fieldClass}
                maxlength="160"
                value={field().state.value}
                onInput={(event) => field().handleChange(event.currentTarget.value)}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="emphasis">
          {(field) => (
            <label class={labelClass}>
              Онцлох хэлбэр
              <select
                class={fieldClass}
                value={field().state.value}
                onChange={(event) =>
                  field().handleChange(
                    v.parse(
                      v.picklist(["neutral", "promotion", "important"]),
                      event.currentTarget.value,
                    ),
                  )
                }
              >
                <option value="neutral">Энгийн</option>
                <option value="promotion">Урамшуулал</option>
                <option value="important">Чухал</option>
              </select>
            </label>
          )}
        </form.Field>
        <form.Field name="link">
          {(field) => (
            <div class="grid gap-3">
              <label class="flex min-h-11 items-center gap-2 font-bold">
                <input
                  type="checkbox"
                  checked={field().state.value !== null}
                  onChange={(event) =>
                    field().handleChange(
                      event.currentTarget.checked ? { label: "Дэлгэрэнгүй", href: "/" } : null,
                    )
                  }
                />
                Дотоод холбоос нэмэх
              </label>
              <Show when={field().state.value}>
                {(link) => (
                  <div class="grid gap-3 sm:grid-cols-2">
                    <label class={labelClass}>
                      Холбоосын бичвэр
                      <input
                        class={fieldClass}
                        maxlength="60"
                        value={link().label}
                        onInput={(event) =>
                          field().handleChange({ ...link(), label: event.currentTarget.value })
                        }
                      />
                    </label>
                    <label class={labelClass}>
                      Store доторх зам
                      <input
                        class={fieldClass}
                        maxlength="240"
                        placeholder="/products/..."
                        value={link().href}
                        onInput={(event) =>
                          field().handleChange({ ...link(), href: event.currentTarget.value })
                        }
                      />
                    </label>
                  </div>
                )}
              </Show>
            </div>
          )}
        </form.Field>
        <ContentActions
          document={document}
          documentKind="announcement"
          clearLocal={local.discard}
        />
      </fieldset>
    </div>
  );
};

const placements = [
  ["product", "Бүтээгдэхүүн"],
  ["cart", "Сагс"],
  ["checkout", "Захиалга"],
] as const;

export const OrderingNoticesEditor = (
  props: EditorProps<Extract<ContentDocument, { kind: "ordering_notices" }>>,
) => {
  const local = createLocalDraft(() => props.store, props.initial);
  const compatible = local.compatible();
  const restored = compatible.kind === "ordering_notices" ? compatible : props.initial;
  const form = createForm(() => ({
    defaultValues: { ...restored.content, notices: [...restored.content.notices] },
  }));
  const valuesVersion = form.useSelector((state) => JSON.stringify(state.values));
  const document = (): Extract<ContentDocument, { kind: "ordering_notices" }> => ({
    kind: "ordering_notices",
    content: v.parse(OrderingNoticesDocumentSchema, form.state.values),
  });
  createEffect(
    on(
      valuesVersion,
      () => {
        if (local.issue()) {
          return;
        }
        const parsed = v.safeParse(OrderingNoticesDocumentSchema, form.state.values);
        if (parsed.success) {
          local.setDraft({ kind: "ordering_notices", content: parsed.output });
        }
      },
      { defer: true },
    ),
  );
  return (
    <div class="grid gap-4">
      <DraftRecovery issue={local.issue} discard={local.discard} />
      <fieldset class="grid max-w-3xl gap-4 border-0 p-0" disabled={Boolean(local.issue())}>
        <form.Field name="notices">
          {(field) => (
            <div class="grid gap-4">
              <Index each={field().state.value}>
                {(notice, index) => (
                  <article class="grid gap-3 rounded-lg border border-black/15 bg-white p-4">
                    <div class="flex items-center justify-between gap-3">
                      <strong>Мэдээлэл {index + 1}</strong>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          field().handleChange(
                            field().state.value.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                      >
                        Устгах
                      </Button>
                    </div>
                    <label class="flex min-h-11 items-center gap-2 font-bold">
                      <input
                        type="checkbox"
                        checked={notice().enabled}
                        onChange={(event) =>
                          field().handleChange(
                            field().state.value.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, enabled: event.currentTarget.checked }
                                : item,
                            ),
                          )
                        }
                      />
                      Идэвхтэй
                    </label>
                    <label class={labelClass}>
                      Гарчиг
                      <input
                        class={fieldClass}
                        maxlength="80"
                        value={notice().title}
                        onInput={(event) =>
                          field().handleChange(
                            field().state.value.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, title: event.currentTarget.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <label class={labelClass}>
                      Тайлбар · хязгаарлагдсан Markdown
                      <textarea
                        class={`${fieldClass} min-h-32 py-3`}
                        maxlength="2000"
                        value={notice().contentMarkdown}
                        onInput={(event) =>
                          field().handleChange(
                            field().state.value.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, contentMarkdown: event.currentTarget.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <fieldset class="flex flex-wrap gap-3 border-0 p-0">
                      <legend class="mb-2 text-sm font-bold">Харуулах байрлал</legend>
                      <For each={placements}>
                        {([placement, label]) => (
                          <label class="flex min-h-11 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={notice().placements.includes(placement)}
                              onChange={(event) =>
                                field().handleChange(
                                  field().state.value.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          placements: event.currentTarget.checked
                                            ? [...item.placements, placement]
                                            : item.placements.filter(
                                                (value) => value !== placement,
                                              ),
                                        }
                                      : item,
                                  ),
                                )
                              }
                            />
                            {label}
                          </label>
                        )}
                      </For>
                    </fieldset>
                  </article>
                )}
              </Index>
              <Button
                class="w-fit"
                type="button"
                variant="secondary"
                disabled={field().state.value.length >= 12}
                onClick={() =>
                  field().handleChange([
                    ...field().state.value,
                    {
                      id: crypto.randomUUID(),
                      enabled: true,
                      title: "Захиалгын мэдээлэл",
                      contentMarkdown: "Захиалгын нөхцөлийг энд тайлбарлана.",
                      placements: ["product"],
                    },
                  ])
                }
              >
                Мэдээлэл нэмэх
              </Button>
            </div>
          )}
        </form.Field>
        <ContentActions
          document={document}
          documentKind="ordering_notices"
          clearLocal={local.discard}
        />
      </fieldset>
    </div>
  );
};
