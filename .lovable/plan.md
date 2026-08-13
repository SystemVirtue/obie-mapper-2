# Remote Projector Endpoint

Turn the projector output into a device-independent URL so a TV, tablet, laptop or mini-PC on any network can display the mapped output while all controls stay in the main studio UI.

## How it works for you

1. In the studio settings you get a **Remote Projector** block: a toggle (ON/OFF), the generated projector ID, its full URL, a copy button, a QR code, and a "Regenerate ID" action.
2. Turning it ON publishes the current scene to the cloud. Every edit is published continuously (debounced), so the remote display follows along within about a second.
3. On the display device you open `/p/<projector-id>` — it goes fullscreen, black chrome, no controls, and renders the warped output exactly like the local projector window.
4. The remote display keeps the **last published scene** even after a reload or with the studio closed, because the snapshot lives in the cloud, not in the browser.
5. Media (videos/images) used in a scene uploads once to cloud storage so remote devices can actually play it. Upload progress shows in the scene panel.
6. Corner pinning / gain / brightness for the remote output are edited in the studio UI (the remote screen is display-only, since it may be across the room).

## Status overlay on the remote screen

The remote endpoint always tells you what it is doing, centered on black:

- No/unknown ID → "No projector ID — open Settings → Remote Projector in the studio" plus the ID entry field.
- Valid ID, never published → "Waiting for first scene from studio".
- Published but toggle OFF or studio idle > 30s → small corner badge "Studio offline — showing last saved scene".
- Output paused (new Pause control in the studio) → "Output paused" over a black frame.
- Media still uploading → per-layer placeholder with "Media uploading…".
- Connection/fetch failure → "Reconnecting…" with retry countdown.

Badges auto-hide after a few seconds when everything is healthy so a live projection stays clean.

## Access model

The projector ID is an unguessable random token (e.g. `pj_9f3k...`, 22+ chars). Anyone with the link can view that output; no login on the display device. Regenerating the ID immediately invalidates the old link. Only geometry, layer parameters and links to uploaded media are exposed — nothing else about the account.

## Technical plan

**Backend (Lovable Cloud, enabled as part of this work)**

- Table `public.projector_channels`:
  `id uuid pk`, `token text unique`, `owner_id uuid null` (nullable: studio is currently login-free), `enabled boolean default true`, `paused boolean default false`, `scene jsonb`, `revision bigint default 0`, `updated_at timestamptz`.
- Grants: `GRANT SELECT ON public.projector_channels TO anon;` (token-scoped read), `GRANT SELECT, INSERT, UPDATE ON ... TO authenticated;`, `GRANT ALL ... TO service_role;` RLS enabled. `anon` SELECT policy allows reads (row is only reachable by knowing the token, and server functions project safe columns only). Writes go through server functions holding the token.
- Storage bucket `projector-media` (public read) for scene images/videos, so remote devices can stream them by URL.
- Server functions in `src/lib/projector.functions.ts`:
  - `createProjectorChannel()` → returns `{ token }` (crypto-random, generated inside the handler).
  - `publishProjectorScene({ token, scene, enabled, paused })` → upserts scene + bumps `revision`, stamps `updated_at`.
  - `getProjectorScene({ token, sinceRevision })` → returns `{ status, revision, scene?, updatedAt }`; `304`-style no-op when unchanged; `status` is one of `unknown | waiting | live | stale | paused | disabled`.

**Client**

- `src/lib/projector-link.ts`: persist `token` in `localStorage` (`spm.projectorToken`) plus `remoteEnabled`; helpers to build the share URL and QR data.
- `src/lib/use-remote-publisher.ts`: watches editor state, strips blob URLs to uploaded public URLs, debounces ~700ms, calls `publishProjectorScene`. Heartbeat every 10s so the remote can detect "studio offline".
- Media upload: on asset add and on publish, any `blob:`-backed asset is uploaded to `projector-media` (content-hash key so re-uploads are skipped) and the scene records the public URL. `media-cache` prefers the remote URL when present.
- New route `src/routes/p.$token.tsx` (`/p/$token`): polls `getProjectorScene` every 1.5s with `sinceRevision`, renders existing `ProjectorViewport` with `showHandles={false}`, `<StatusOverlay />` for the states above, auto-fullscreen on first user gesture (browsers require one), `robots: noindex`, own `head()` metadata. `src/routes/p.index.tsx` shows the ID entry form when no token is given.
- `StudioHeader` / `InspectorPanel`: new **Remote Projector** section — enable toggle, ID display + copy, QR, Regenerate, Pause output, and a live "last published Xs ago" indicator. Existing local `BroadcastChannel` window and split view stay unchanged and keep working offline.

**Not changed:** the current `/projector` same-browser window, homography math, GLSL shader, scene save/recall in IndexedDB, recorder.

## Verification

Playwright: publish from `/` with remote enabled, open `/p/<token>` in a second context, confirm layers render, confirm the snapshot survives a reload with the editor tab closed, and confirm each status overlay state (no ID, waiting, paused, stale).
