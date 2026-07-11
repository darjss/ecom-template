import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { api, unwrap } from "@/lib/api";

const projectsKey = ["projects"];

export const useProjects = () =>
  useQuery(() => ({
    queryKey: projectsKey,
    queryFn: async () => unwrap(await api.projects.get()),
  }));

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (name: string) => unwrap(await api.projects.post({ name })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
  }));
};

export const useRenameProject = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (input: { id: string; name: string }) =>
      unwrap(await api.projects({ id: input.id }).patch({ name: input.name })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
  }));
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  return useMutation(() => ({
    mutationFn: async (id: string) => unwrap(await api.projects({ id }).delete()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
  }));
};
