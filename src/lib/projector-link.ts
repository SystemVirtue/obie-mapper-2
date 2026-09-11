const ENABLED_KEY = "spm.projectorEnabled";
const PAUSED_KEY = "spm.projectorPaused";

/**
 * Fixed channel for the permanent kiosk output endpoint (`/liveoutput`).
 * Persistent by design: kiosk devices are configured once and never change URL.
 */
export const LIVE_OUTPUT_TOKEN = "liveoutput";

function read(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(key);
}

function write(key: string, value: string | null) {
  if (typeof localStorage === "undefined") return;
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}

export function getRemoteEnabled(): boolean {
  return read(ENABLED_KEY) !== "0";
}

export function setRemoteEnabled(value: boolean) {
  write(ENABLED_KEY, value ? "1" : "0");
}

export function getRemotePaused(): boolean {
  return read(PAUSED_KEY) === "1";
}

export function setRemotePaused(value: boolean) {
  write(PAUSED_KEY, value ? "1" : "0");
}

/** Absolute URL of the permanent fullscreen output endpoint. */
export function projectorUrl(): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/liveoutput`;
}
