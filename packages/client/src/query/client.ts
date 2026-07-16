import { MutationCache, QueryCache, QueryClient } from "@tanstack/solid-query";
import { toast } from "solid-sonner";

const presentGlobalError = (error: Error) => {
  toast.error(error.message || "Холболт тасарлаа. Дахин оролдоно уу.");
};

export const createStoreQueryClient = () =>
  new QueryClient({
    queryCache: new QueryCache({ onError: presentGlobalError }),
    mutationCache: new MutationCache({ onError: presentGlobalError }),
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
