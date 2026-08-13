const TOKEN_KEY = "spm.projectorToken";
const ENABLED_KEY = "spm.projectorEnabled";
const PAUSED_KEY = "spm.projectorPaused";

function read(key: string): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(key);
}

function write(key: string, value: string | null) {
  if (typeof localStorage === "undefined") return;
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}

export function getStoredToken(): string | null {
  return read(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  write(TOKEN_KEY, token);
}

export function getRemoteEnabled(): boolean {
  return read(ENABLED_KEY) === "1";
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

/** Absolute URL of the dedicated fullscreen output endpoint for a token. */
export function projectorUrl(token: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/p/${token}`;
}
