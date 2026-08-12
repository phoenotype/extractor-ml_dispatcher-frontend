import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";

export function useUnsavedGuard(dirty: boolean) {
  const [pendingLeave, setPendingLeave] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const blocker = useBlocker(dirty);

  useEffect(() => {
    if (blocker.state === "blocked") {
      setPendingLeave(true);
    }
  }, [blocker.state]);

  const confirmLeave = useCallback(() => {
    setPendingLeave(false);
    resolver.current?.(true);
    resolver.current = null;
    if (blocker.state === "blocked") blocker.proceed();
  }, [blocker]);

  const cancelLeave = useCallback(() => {
    setPendingLeave(false);
    resolver.current?.(false);
    resolver.current = null;
    if (blocker.state === "blocked") blocker.reset();
  }, [blocker]);

  const requestLeave = useCallback(() => {
    if (!dirty) return Promise.resolve(true);
    setPendingLeave(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, [dirty]);

  return {
    pendingLeave,
    confirmLeave,
    cancelLeave,
    requestLeave,
  };
}
