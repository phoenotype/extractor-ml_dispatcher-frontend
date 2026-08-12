import { useQuery } from "@tanstack/react-query";
import { dispatcherApi } from "@/services/api/dispatcher";

export function useCatalogQuery() {
  return useQuery({
    queryKey: ["catalog"],
    queryFn: () => dispatcherApi.getCatalog(),
    staleTime: 60_000,
  });
}
