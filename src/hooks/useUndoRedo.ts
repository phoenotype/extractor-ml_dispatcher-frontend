import { useCallback, useRef, useState } from "react";

export function useUndoRedo<T>(initial: T, clone: (value: T) => T) {
  const [present, setPresent] = useState(initial);
  const [availability, setAvailability] = useState({
    canUndo: false,
    canRedo: false,
  });
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);

  const reset = useCallback(
    (value: T) => {
      past.current = [];
      future.current = [];
      setAvailability({ canUndo: false, canRedo: false });
      setPresent(clone(value));
    },
    [clone],
  );

  const push = useCallback(
    (value: T) => {
      past.current.push(clone(present));
      past.current = past.current.slice(-40);
      future.current = [];
      setAvailability({ canUndo: true, canRedo: false });
      setPresent(clone(value));
    },
    [clone, present],
  );

  const replace = useCallback(
    (value: T) => {
      setPresent(clone(value));
    },
    [clone],
  );

  const undo = useCallback(() => {
    const previous = past.current.pop();
    if (!previous) return;
    future.current.push(clone(present));
    setAvailability({
      canUndo: past.current.length > 0,
      canRedo: true,
    });
    setPresent(previous);
  }, [clone, present]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(clone(present));
    setAvailability({
      canUndo: true,
      canRedo: future.current.length > 0,
    });
    setPresent(next);
  }, [clone, present]);

  return {
    present,
    setPresent: push,
    replace,
    reset,
    undo,
    redo,
    ...availability,
  };
}
