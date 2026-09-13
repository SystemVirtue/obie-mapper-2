# Simplified live output and playlists

## What will change

- Fix `/liveoutput` so its floating controls disappear after five seconds without pointer, touch, or keyboard activity, then return on the next interaction.
- Add one compact **Playlist** tab beside **Scenes** in the studio sidebar.
- Let users add saved scenes, reorder or remove them, set seconds and a fade duration per item, and turn looping on or off.
- Add one **Output mode** selector in Live output: **Current**, **Playlist**, **Hidden**, or **Test pattern**.
- Keep the permanent `/liveoutput` address and existing kiosk behavior.

## Playback behavior

- **Current** publishes the scene currently open in the studio.
- **Playlist** publishes the playlist and lets the kiosk advance it locally, so playback continues after the studio closes.
- **Hidden** shows black while keeping the endpoint connected.
- **Test pattern** publishes the current geometry with the calibration pattern enabled.
- Playlist changes are saved on the studio device and published to the existing live-output record whenever output is enabled.

## Simplified UI

- Use a two-tab switch, a single mode dropdown, and compact playlist rows.
- Avoid timelines, scheduling, nested dialogs, and advanced transition editors.
- Use only duration, fade, reorder, remove, loop, and play/pause controls.

## Technical details

- Extend the published JSON payload with a backwards-compatible output package containing mode, current scene, and prepared playlist scenes.
- Reuse the existing media upload pipeline for every playlist scene.
- Detect both legacy single-scene snapshots and the new package in the remote output.
- Run playlist timing in the kiosk page and apply a simple fade-through-black transition.
- Preserve the current database schema and public password-free endpoint.

## Verification

- Confirm controls hide after five idle seconds and reappear on click/tap/movement.
- Confirm each mode renders correctly.
- Confirm a multi-scene playlist loops with its saved timing after the studio page closes.
- Confirm the project builds cleanly and controls remain usable at desktop and phone widths.
