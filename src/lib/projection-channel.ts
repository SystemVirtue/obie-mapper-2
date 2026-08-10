import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDefaultState,
  type CornerPin,
  type ProjectState,
} from "./projection-types";

export const CHANNEL_NAME = "side-projection-suite";

type Message =
  | { type: "state"; state: ProjectState }
  | { type: "request" }
  | { type: "corners"; corners: CornerPin[]; gainLeft: number; gainRight: number };

function openChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return null;
  }
}

/** Editor side: broadcasts state, accepts corner/gain patches from the projector. */
export function useEditorBroadcast(
  state: ProjectState,
  patch: (partial: Partial<ProjectState>) => void,
) {
  const channelRef = useRef<BroadcastChannel | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const channel = openChannel();
    channelRef.current = channel;
    setSupported(Boolean(channel));
    if (!channel) return;

    const onMessage = (event: MessageEvent<Message>) => {
      const msg = event.data;
      if (msg?.type === "request") {
        channel.postMessage({ type: "state", state: stateRef.current } satisfies Message);
      } else if (msg?.type === "corners") {
        patch({
          corners: msg.corners,
          gainLeft: msg.gainLeft,
          gainRight: msg.gainRight,
        });
      }
    };
    channel.addEventListener("message", onMessage);
    return () => {
      channel.removeEventListener("message", onMessage);
      channel.close();
      channelRef.current = null;
    };
  }, [patch]);

  useEffect(() => {
    channelRef.current?.postMessage({ type: "state", state } satisfies Message);
  }, [state]);

  return { supported };
}

/** Projector side: mirrors editor state and pushes corner-pin edits back. */
export function useProjectorMirror() {
  const [state, setState] = useState<ProjectState>(() => createDefaultState());
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const channel = openChannel();
    channelRef.current = channel;
    if (!channel) return;

    const onMessage = (event: MessageEvent<Message>) => {
      if (event.data?.type === "state") {
        setState(event.data.state);
        setConnected(true);
      }
    };
    channel.addEventListener("message", onMessage);
    channel.postMessage({ type: "request" } satisfies Message);
    const retry = window.setInterval(() => {
      channel.postMessage({ type: "request" } satisfies Message);
    }, 2000);

    return () => {
      window.clearInterval(retry);
      channel.removeEventListener("message", onMessage);
      channel.close();
      channelRef.current = null;
    };
  }, []);

  const pushCorners = useCallback(
    (corners: CornerPin[], gainLeft: number, gainRight: number) => {
      setState((prev) => ({ ...prev, corners, gainLeft, gainRight }));
      channelRef.current?.postMessage({
        type: "corners",
        corners,
        gainLeft,
        gainRight,
      } satisfies Message);
    },
    [],
  );

  return { state, connected, pushCorners };
}
