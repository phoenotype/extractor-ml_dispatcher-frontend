import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dispatcherApi } from "@/services/api/dispatcher";
import type { HttpConnection } from "@/types/connection";
import type { ApiResult } from "@/types/api";

export function useConnectionMutations() {
  const queryClient = useQueryClient();

  const upsertConnection = useMutation({
    mutationFn: (body: HttpConnection) =>
      dispatcherApi.upsertConnection(body.connectionName, body),
    onSuccess: (saved) => {
      queryClient.setQueryData<ApiResult<HttpConnection[]>>(
        ["connections"],
        (current) => {
          const items = current?.data ?? [];
          const exists = items.some(
            (item) => item.connectionName === saved.connectionName,
          );
          return {
            data: exists
              ? items.map((item) =>
                  item.connectionName === saved.connectionName ? saved : item,
                )
              : [...items, saved],
            source: current?.source ?? "api",
          };
        },
      );
      void queryClient.invalidateQueries({ queryKey: ["connections"] });
    },
  });

  return { upsertConnection };
}
