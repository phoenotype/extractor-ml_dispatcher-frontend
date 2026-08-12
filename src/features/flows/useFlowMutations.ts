import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dispatcherApi } from "@/services/api/dispatcher";
import type { CreateFlowBody, UpdateFlowBody, ValidateFlowBody } from "@/types/api";
import type { RunRequest, SimulationRequest } from "@/types/flow";

export function useFlowMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["flows"] });
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
    mutationFn: (flowName: string) => dispatcherApi.deactivateFlow(flowName),
    onSuccess: invalidate,
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
    validate,
    validateFlow,
    simulate,
    run,
  };
}
