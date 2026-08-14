import { useQuery } from "@tanstack/react-query";
import { dispatcherApi } from "@/services/api/dispatcher";

export function useConnectionsQuery() {
  return useQuery({
    queryKey: ["connections"],
    queryFn: () => dispatcherApi.listConnections(),
  });
}
