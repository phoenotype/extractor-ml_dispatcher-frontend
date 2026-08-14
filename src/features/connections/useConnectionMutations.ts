import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dispatcherApi } from "@/services/api/dispatcher";
import type { HttpConnection } from "@/types/connection";

export function useConnectionMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["connections"] });
  };

  const upsertConnection = useMutation({
    mutationFn: (body: HttpConnection) =>
      dispatcherApi.upsertConnection(body.connectionName, body),
    onSuccess: invalidate,
  });

  return { upsertConnection };
}
