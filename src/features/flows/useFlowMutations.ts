import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dispatcherApi, normalizeListItem } from "@/services/api/dispatcher";
import type {
  ApiResult,
  CreateFlowBody,
  UpdateFlowBody,
  ValidateFlowBody,
} from "@/types/api";
import type {
  FlowDetail,
  FlowListItem,
  RunRequest,
  SimulationRequest,
} from "@/types/flow";

export function useFlowMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["flows"] });
  };

  const updateFlowStatusCache = (detail: FlowDetail) => {
    const item = normalizeListItem(detail as unknown as Record<string, unknown>);
    queryClient.setQueriesData<ApiResult<FlowListItem[]>>(
      { queryKey: ["flows"] },
      (current) =>
        current
          ? {
              ...current,
              data: current.data.map((flow) =>
                flow.flowName === detail.flowName ? item : flow,
              ),
            }
          : current,
    );
    invalidate();
  };

  const resolveExpectedUpdatedAt = async (
    flowName: string,
    expectedUpdatedAt?: string,
  ) => {
    if (expectedUpdatedAt) return expectedUpdatedAt;
    const latest = await dispatcherApi.getFlow(flowName);
    const token = latest.expectedUpdatedAt || latest.updatedAt;
    if (!token) throw new Error("updatedAt non disponibile per il flusso");
    return token;
  };

  const createFlow = useMutation({
    mutationFn: (body: CreateFlowBody) => dispatcherApi.createFlow(body),
    onSuccess: invalidate,
  });

  const updateFlow = useMutation({
    mutationFn: ({
      flowName,
      body,
    }: {
      flowName: string;
      body: UpdateFlowBody;
    }) => dispatcherApi.updateFlow(flowName, body),
    onSuccess: invalidate,
  });

  const deactivateFlow = useMutation({
    mutationFn: ({
      flowName,
      expectedUpdatedAt,
    }: {
      flowName: string;
      expectedUpdatedAt?: string;
    }) =>
      resolveExpectedUpdatedAt(flowName, expectedUpdatedAt).then((token) =>
        dispatcherApi.deactivateFlow(flowName, { expectedUpdatedAt: token }),
      ),
    onSuccess: updateFlowStatusCache,
  });

  const activateFlow = useMutation({
    mutationFn: ({
      flowName,
      expectedUpdatedAt,
    }: {
      flowName: string;
      expectedUpdatedAt?: string;
    }) =>
      resolveExpectedUpdatedAt(flowName, expectedUpdatedAt).then((token) =>
        dispatcherApi.activateFlow(flowName, { expectedUpdatedAt: token }),
      ),
    onSuccess: updateFlowStatusCache,
  });

  const validate = useMutation({
    mutationFn: (body: ValidateFlowBody) => dispatcherApi.validate(body),
  });

  const validateFlow = useMutation({
    mutationFn: ({
      flowName,
      body,
    }: {
      flowName: string;
      body: ValidateFlowBody;
    }) => dispatcherApi.validateFlow(flowName, body),
  });

  const simulate = useMutation({
    mutationFn: ({
      flowName,
      body,
    }: {
      flowName: string;
      body: SimulationRequest;
    }) => dispatcherApi.simulate(flowName, body),
  });

  const run = useMutation({
    mutationFn: ({
      flowName,
      body,
    }: {
      flowName: string;
      body: RunRequest;
    }) => dispatcherApi.run(flowName, body),
  });

  return {
    createFlow,
    updateFlow,
    deactivateFlow,
    activateFlow,
    validate,
    validateFlow,
    simulate,
    run,
  };
}
