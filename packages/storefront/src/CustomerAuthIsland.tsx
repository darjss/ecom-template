import {
  createCustomerQueryClient,
  customerAuthMutationOptions,
  customerSessionQueryOptions,
} from "@ecom/client";
import { Button } from "@ecom/ui";
import { createForm } from "@tanstack/solid-form";
import {
  QueryClientProvider,
  createMutation,
  createQuery,
  useQueryClient,
} from "@tanstack/solid-query";
import { createSignal, onCleanup, onMount, Show } from "solid-js";

export const CustomerAuthPanel = () => {
  const queryClient = useQueryClient();
  const session = createQuery(() => customerSessionQueryOptions());
  const mutation = createMutation(() => customerAuthMutationOptions(queryClient));
  const [awaitingCode, setAwaitingCode] = createSignal(false);
  const [countdown, setCountdown] = createSignal(0);
  onMount(() => {
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1_000);
    onCleanup(() => window.clearInterval(timer));
  });

  const form = createForm(() => ({
    defaultValues: { phone: "", code: "", message: "" },
    onSubmit: async ({ value }) => {
      form.setFieldValue("message", "");
      try {
        if (!awaitingCode()) {
          await mutation.mutateAsync({ kind: "request_otp", phone: value.phone });
          setAwaitingCode(true);
          setCountdown(30);
          form.setFieldValue("message", "Хэрэв дугаар зөв бол баталгаажуулах код илгээгдлээ.");
          return;
        }
        await mutation.mutateAsync({
          kind: "verify_otp",
          phone: value.phone,
          code: value.code,
        });
        form.setFieldValue("code", "");
        form.setFieldValue("message", "Амжилттай нэвтэрлээ.");
      } catch (error) {
        const retryAfter =
          typeof error === "object" &&
          error !== null &&
          "kind" in error &&
          error.kind === "api" &&
          "error" in error &&
          typeof error.error === "object" &&
          error.error !== null &&
          "retryAfterSeconds" in error.error &&
          typeof error.error.retryAfterSeconds === "number"
            ? error.error.retryAfterSeconds
            : undefined;
        if (retryAfter) {
          setCountdown(retryAfter);
        }
        form.setFieldValue(
          "message",
          retryAfter
            ? `${retryAfter} секундын дараа дахин оролдоно уу.`
            : "Нэвтрэх үйлдлийг хийж чадсангүй. Мэдээллээ шалгаад дахин оролдоно уу.",
        );
      }
    },
  }));

  const logout = async () => {
    try {
      await mutation.mutateAsync({ kind: "logout" });
    } finally {
      setAwaitingCode(false);
      setCountdown(0);
      form.reset();
    }
  };

  return (
    <div class="customer-auth-panel">
      <Show
        when={session.data?.data.kind === "authenticated"}
        fallback={
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              await form.handleSubmit();
            }}
          >
            <form.Field name="phone">
              {(field) => (
                <label>
                  Утасны дугаар
                  <input
                    name={field().name}
                    type="tel"
                    inputmode="tel"
                    autocomplete="tel"
                    placeholder="9911 2233"
                    value={field().state.value}
                    disabled={awaitingCode()}
                    onInput={(event) => field().handleChange(event.currentTarget.value)}
                  />
                </label>
              )}
            </form.Field>
            <Show when={awaitingCode()}>
              <form.Field name="code">
                {(field) => (
                  <label>
                    4 оронтой код
                    <input
                      name={field().name}
                      inputmode="numeric"
                      autocomplete="one-time-code"
                      pattern="[0-9]{4}"
                      maxlength={4}
                      value={field().state.value}
                      onInput={(event) => field().handleChange(event.currentTarget.value)}
                    />
                  </label>
                )}
              </form.Field>
            </Show>
            <Button
              type="submit"
              disabled={mutation.isPending || (!awaitingCode() && countdown() > 0)}
            >
              {mutation.isPending
                ? "Түр хүлээнэ үү…"
                : awaitingCode()
                  ? "Код баталгаажуулах"
                  : countdown() > 0
                    ? `${countdown()} сек`
                    : "Код авах"}
            </Button>
            <Show when={awaitingCode()}>
              <button
                class="customer-auth-reset"
                type="button"
                onClick={() => {
                  setAwaitingCode(false);
                  form.setFieldValue("code", "");
                }}
              >
                Дугаар солих
              </button>
            </Show>
            <form.Subscribe selector={(state) => state.values.message}>
              {(message) => (
                <p class="customer-auth-message" role="status" aria-live="polite">
                  {message()}
                </p>
              )}
            </form.Subscribe>
          </form>
        }
      >
        <p class="customer-auth-signed-in">
          <strong>Нэвтэрсэн</strong>
          <span>{session.data?.data.kind === "authenticated" ? session.data.data.phone : ""}</span>
        </p>
        <Button variant="secondary" onClick={logout} disabled={mutation.isPending}>
          Гарах
        </Button>
      </Show>
    </div>
  );
};

export const CustomerAuthIsland = () => {
  const queryClient = createCustomerQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <CustomerAuthPanel />
    </QueryClientProvider>
  );
};
