import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";

import { isStudioUnlocked, unlockStudio } from "@/lib/gate.functions";

const FLAG = "spm.studioUnlocked";

export function clearStudioUnlockFlag() {
  if (typeof localStorage !== "undefined") localStorage.removeItem(FLAG);
}

/**
 * Password gate for the studio UI only. The dedicated output endpoints
 * (`/p/<code>`, `/projector`) are never gated.
 */
export default function StudioGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const remembered = typeof localStorage !== "undefined" && localStorage.getItem(FLAG) === "1";
    if (remembered) setUnlocked(true);
    void isStudioUnlocked()
      .then((res) => {
        if (cancelled) return;
        setUnlocked(res.unlocked);
        if (res.unlocked) localStorage.setItem(FLAG, "1");
        else clearStudioUnlockFlag();
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setBusy(true);
      try {
        const { ok } = await unlockStudio({ data: { password } });
        if (ok) {
          localStorage.setItem(FLAG, "1");
          setUnlocked(true);
          setError(false);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        setBusy(false);
        setPassword("");
      }
    },
    [password],
  );

  if (unlocked) return <>{children}</>;

  if (!checked) {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-background text-xs text-muted-foreground">
        Loading studio…
      </main>
    );
  }

  return (
    <main className="flex h-screen w-screen items-center justify-center bg-background px-6">
      <form
        onSubmit={(event) => void submit(event)}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-card/70 p-6 text-center backdrop-blur"
      >
        <div className="flex items-center justify-center gap-2 text-foreground">
          <Lock className="size-4" />
          <h1 className="text-sm font-semibold">Studio access</h1>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Enter the studio password. This device will be remembered.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Studio password"
          aria-label="Studio password"
          autoComplete="current-password"
          autoFocus
          className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-center text-xs text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary"
        />

        {error ? <p className="text-[11px] text-destructive">Incorrect password</p> : null}
        <button
          type="submit"
          disabled={busy || !password}
          className="w-full rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Checking…" : "Unlock studio"}
        </button>
      </form>
    </main>
  );
}
