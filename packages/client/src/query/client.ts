import { ClientErrorSchema, StaffClientErrorSchema } from "@ecom/contracts";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/solid-query";
import { toast } from "solid-sonner";
import * as v from "valibot";

const parseClientError = (error: unknown) => {
  const common = v.safeParse(ClientErrorSchema, error);
  return common.success ? common : v.safeParse(StaffClientErrorSchema, error);
};

const retrySafeFailure = (failureCount: number, error: unknown) => {
  if (failureCount >= 1) {
    return false;
  }
  const parsed = parseClientError(error);
  return (
    parsed.success &&
    (parsed.output.kind === "network" ||
      (parsed.output.kind === "api" && parsed.output.error.code === "unavailable"))
  );
};

const presentGlobalError = (error: unknown) => {
  const parsed = parseClientError(error);
  if (!parsed.success) {
    toast.error("Тодорхойгүй алдаа гарлаа.");
    return;
  }
  if (parsed.output.kind === "network") {
    toast.error("Холболт тасарлаа. Дахин оролдоно уу.");
    return;
  }
  if (parsed.output.kind === "contract") {
    toast.error("Үйлчилгээний хариуг шалгаж чадсангүй.");
    return;
  }
  if (parsed.output.error.code === "unauthorized") {
    window.location.assign("/admin/login");
    return;
  }
  if (parsed.output.error.code === "rate_limited") {
    toast.error("Хэт олон хүсэлт илгээлээ. Түр хүлээнэ үү.");
    return;
  }
  if (parsed.output.error.code === "unavailable") {
    toast.error("Үйлчилгээ түр ажиллахгүй байна.");
    return;
  }
  toast.error(parsed.output.error.message);
};

export const createStoreQueryClient = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: presentGlobalError }),
    mutationCache: new MutationCache({ onError: presentGlobalError }),
    defaultOptions: {
      queries: {
        retry: retrySafeFailure,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
