import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Chromecast support via the Presentation API. Because the remote projector
 * lives on a public URL, a Cast device can load it directly and render the
 * output full screen with no studio involvement.
 */

interface PresentationConnection {
  id: string;
  state: "connecting" | "connected" | "closed" | "terminated";
  close(): void;
  terminate(): void;
  onclose: (() => void) | null;
  onterminate: (() => void) | null;
  onconnect: (() => void) | null;
}

interface PresentationAvailability {
  value: boolean;
  onchange: (() => void) | null;
}

interface PresentationRequestLike {
  start(): Promise<PresentationConnection>;
  getAvailability(): Promise<PresentationAvailability>;
}

type PresentationRequestCtor = new (urls: string[]) => PresentationRequestLike;

function getCtor(): PresentationRequestCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { PresentationRequest?: PresentationRequestCtor })
    .PresentationRequest;
  return typeof ctor === "function" ? ctor : null;
}

export type CastState = "unsupported" | "unavailable" | "idle" | "connecting" | "casting";

export function useCast(url: string) {
  const [state, setState] = useState<CastState>("unsupported");
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<PresentationConnection | null>(null);
  const availabilityRef = useRef<PresentationAvailability | null>(null);

  useEffect(() => {
    const ctor = getCtor();
    if (!ctor || !url) {
      setState("unsupported");
      return;
    }
    let cancelled = false;
    setState("unavailable");
    let request: PresentationRequestLike;
    try {
      request = new ctor([url]);
    } catch {
      setState("unsupported");
      return;
    }
    request
      .getAvailability()
      .then((availability) => {
        if (cancelled) return;
        availabilityRef.current = availability;
        const apply = () => {
          if (connectionRef.current?.state === "connected") return;
          setState(availability.value ? "idle" : "unavailable");
        };
        availability.onchange = apply;
        apply();
      })
      .catch(() => {
        // Some builds reject getAvailability but can still start a session.
        if (!cancelled) setState("idle");
      });

    return () => {
      cancelled = true;
      if (availabilityRef.current) availabilityRef.current.onchange = null;
    };
  }, [url]);

  const startCast = useCallback(async () => {
    const ctor = getCtor();
    if (!ctor || !url) return;
    setError(null);
    setState("connecting");
    try {
      const connection = await new ctor([url]).start();
      connectionRef.current = connection;
      connection.onclose = () => {
        connectionRef.current = null;
        setState("idle");
      };
      connection.onterminate = () => {
        connectionRef.current = null;
        setState("idle");
      };
      setState("casting");
    } catch (err) {
      connectionRef.current = null;
      setState("idle");
      const message = err instanceof Error ? err.message : "Could not start casting";
      setError(/cancel|abort/i.test(message) ? null : message);
    }
  }, [url]);

  const stopCast = useCallback(() => {
    const connection = connectionRef.current;
    connectionRef.current = null;
    setState("idle");
    try {
      connection?.terminate();
    } catch {
      try {
        connection?.close();
      } catch {
        // ignore
      }
    }
  }, []);

  return { state, error, startCast, stopCast };
}
