# Password-gated studio, always-live output endpoint

Two changes: the studio UI asks for a password once per device, and the remote output endpoint runs on its own with no password and keeps itself up to date.

## 1. Studio password gate

- On first visit to the studio (`/`), a small centered card asks for a password before the studio loads. Nothing else renders behind it.
- Password is `Obie`, case-insensitive, surrounding spaces ignored.
- Correct password → the device is remembered, so future visits and reloads go straight into the studio. Wrong password → generic "Incorrect password" message, no hints.
- The unlock check runs on the server (the password is never shipped in the page code), and the remembered state is stored on the device so it survives reloads.
- A small "Lock" action in the studio header clears the remembered state on that device.
- Only the studio is gated. `/p/<code>` and the local `/projector` window stay open — no password, no redirect.

## 2. Output endpoint independent of the UI

The cloud-published output already survives the studio being closed, but today it only starts once you manually create a code and flip "Enable remote projector" on. Changes:

- On first studio load, a projector code is created automatically and remote publishing is enabled by default, so an output endpoint always exists.
- The Remote projector panel keeps toggle, pause, regenerate, copy link and QR; it now shows the code as already active instead of an empty "create code" state.
- Publishing stays automatic: every scene edit publishes within ~1s, plus a heartbeat, so an open `/p/<code>` display follows the studio without any manual step. With the studio closed, the display keeps showing the last published scene (with the existing "Studio offline" badge).

## Technical notes

- New `src/lib/gate.functions.ts`: `unlockStudio({ password })` compares a lower-cased input against server-only `SITE_PASSWORD` using a timing-safe hash compare, and on success sets an encrypted session cookie (`useSession` with server-only `SESSION_SECRET`, 1-year maxAge, httpOnly). `lockStudio()` clears it. Also `isStudioUnlocked()` for the client to check on mount.
- Secrets added this turn: `SITE_PASSWORD=Obie` and a generated 32+ char `SESSION_SECRET`. Neither is `VITE_`-prefixed.
- New `src/components/StudioGate.tsx`: wraps the studio content in `src/routes/index.tsx`; on mount reads `localStorage` flag `spm.studioUnlocked` (fast path) and confirms with `isStudioUnlocked()`; renders the unlock form otherwise. Route stays public and un-gated in `beforeLoad` so no redirect loops and `/p/*` is untouched.
- `RemoteProjectorPanel`: in its init effect, when no stored token exists, call `createProjectorChannel()` once and `setRemoteEnabled(true)`; guard against double-creation with a ref. No change to `use-remote-publisher.ts` or `projector.functions.ts`.
- Studio scene content is not secret data (it is published to a public output URL by design), so the gate is access control for the editor UI, not encryption of scene data.

## Verification

Playwright: load `/` in a fresh context → unlock form; submit `obie` → studio loads; reload → no prompt; wrong password → error only. Load `/p/<code>` in a separate context with no session → renders output, never prompts.
