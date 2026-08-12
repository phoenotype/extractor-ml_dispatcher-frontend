import { useQuery } from "@tanstack/react-query";
import { dispatcherApi } from "@/services/api/dispatcher";

export function useFlowsQuery() {
  return useQuery({
    queryKey: ["flows", { activeOnly: false }],
    queryFn: () => dispatcherApi.listFlows({ activeOnly: false }),
  });
}
