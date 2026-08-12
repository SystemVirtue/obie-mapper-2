const AUTO_KEY = "spm.autoStartOutput";

/** Persisted preference: auto-launch the projector output window on startup. */
export function getAutoStart(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(AUTO_KEY) === "1";
}

export function setAutoStart(value: boolean) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(AUTO_KEY, value ? "1" : "0");
}

interface ScreenLike {
  availLeft?: number;
  availTop?: number;
  availWidth?: number;
  availHeight?: number;
  isPrimary?: boolean;
}

/** Best-effort secondary-display bounds via the Window Management API. */
async function secondaryScreen(): Promise<ScreenLike | null> {
  const api = window as unknown as {
    getScreenDetails?: () => Promise<{ screens: ScreenLike[]; currentScreen: ScreenLike }>;
  };
  if (!api.getScreenDetails) return null;
  try {
    const details = await api.getScreenDetails();
    const other = details.screens.find((s) => s !== details.currentScreen);
    return other ?? null;
  } catch {
    return null;
  }
}

/**
 * Open (or focus) the projector output window. When a secondary display is
 * reachable the window is positioned on it and asked to go fullscreen.
 */
export async function openProjectorWindow(options?: { fullscreen?: boolean }) {
  const screen = await secondaryScreen();
  const fullscreen = options?.fullscreen ?? Boolean(screen);
  const url = `/projector${fullscreen ? "?fullscreen=1" : ""}`;

  const features = screen
    ? [
        `left=${screen.availLeft ?? 0}`,
        `top=${screen.availTop ?? 0}`,
        `width=${screen.availWidth ?? 1280}`,
        `height=${screen.availHeight ?? 720}`,
        "menubar=no",
        "toolbar=no",
        "location=no",
        "status=no",
      ].join(",")
    : "width=1280,height=720,menubar=no,toolbar=no";

  const win = window.open(url, "projector-output", features);
  win?.focus();
  return win;
}
