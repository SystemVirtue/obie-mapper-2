import { useCallback, useReducer, useRef, useState } from "react";

/**
 * State container with coalesced undo/redo history.
 * Rapid consecutive commits (< 350ms apart) share a single history entry so
 * dragging a node or sliding a value doesn't flood the stack.
 */
export function useHistory<T>(initial: () => T, limit = 80) {
  const [state, setState] = useState<T>(initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const lastPush = useRef(0);
  const [, bump] = useReducer((c: number) => c + 1, 0);

  const commit = useCallback(
    (updater: (prev: T) => T, history = true) => {
      const prev = stateRef.current;
      const next = updater(prev);
      if (next === prev) return;
      if (history) {
        const now = Date.now();
        if (now - lastPush.current > 350) {
          past.current = [...past.current, prev].slice(-limit);
          future.current = [];
          lastPush.current = now;
          bump();
        }
      }
      stateRef.current = next;
      setState(next);
    },
    [limit],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (prev === undefined) return;
    future.current = [...future.current, stateRef.current].slice(-limit);
    stateRef.current = prev;
    setState(prev);
    lastPush.current = 0;
    bump();
  }, [limit]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next === undefined) return;
    past.current = [...past.current, stateRef.current].slice(-limit);
    stateRef.current = next;
    setState(next);
    lastPush.current = 0;
    bump();
  }, [limit]);

  /** Replace state without keeping the previous timeline (project load / new). */
  const reset = useCallback((next: T) => {
    past.current = [];
    future.current = [];
    lastPush.current = 0;
    stateRef.current = next;
    setState(next);
    bump();
  }, []);

  return {
    state,
    stateRef,
    commit,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
