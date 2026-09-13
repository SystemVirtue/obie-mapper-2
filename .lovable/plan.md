# Simpler studio, richer visuals

## A. One tabbed workspace

Replace the crowded stacked sidebar with a single tab bar that follows the real workflow:

```text
[ Assets ] [ Scene ] [ Playlist ] [ Tools ] [ Live Output ] [ Settings ]
```

- Only one tab's controls are visible at a time; the stage stays full height beside them.
- The selected item's properties stay in the right-hand inspector, unchanged in behaviour.
- On a phone the tab bar moves to the bottom and the panel opens as a sheet over the stage.
- Tab choice is remembered on the device.

Tab contents:
- **Assets** — upload images/video, imported external visuals, live camera/mic sources.
- **Scene** — save, recall, duplicate, delete, import/export, wall photo.
- **Playlist** — ordered scene list with seconds, fade, loop, play/pause.
- **Tools** — add shapes, layer list, ordering, lock/hide, blend and opacity.
- **Live Output** — the permanent address, on/off, pause, output mode, cast.
- **Settings** — wall size, output size, brightness, grid, x-ray, auto-start, lock.

## B. Cleanup

- Remove the QR code from Live output; the address is now fixed and never changes.
- Remove the duplicated cast/pause/fullscreen wording so each control appears once.
- Fold the old scattered headings into the tabs above; drop leftover code-entry hints.

## C. Visual capabilities

**Layers, blend modes, opacity**
- Every layer gains a blend mode (normal, multiply, screen, overlay, darken, lighten, colour dodge, colour burn, hard light, soft light, difference, exclusion, hue, saturation, colour, luminosity) plus its existing opacity.
- Layers can be grouped, reordered, soloed, hidden and locked from the Tools tab, so scenes stack like a broadcast switcher.

**External open-source visuals**
- Paste a Shadertoy or Butterchurn link (or pick a bundled preset) and the visual is imported as a live animated layer usable like any other source.
- Bundled presets work offline; pasted links are fetched at import time and stored with the scene.
- Note: Shadertoy links only import when the shader's author allowed public API access; when a link cannot be fetched I will say so in the panel rather than fail silently, and the bundled presets remain available.

**Live audio and camera sources**
- Add microphone/line-in and camera as selectable sources, with permission asked once.
- Audio gives level, bass/mid/treble and beat detection; camera gives the live image and motion level.
- Any layer property (scale, opacity, brightness, note speed/density, colour) can follow one of those signals with a simple amount slider, and a playlist can advance on a beat.

## Delivery order

1. Tabbed workspace, cleanup, playlist tab, output modes, controls auto-hide fix on the output screen.
2. Blend modes, opacity, layer grouping and solo.
3. External visual import.
4. Live audio and camera reactivity.

## Technical details

- New `StudioTabs` shell in `src/routes/index.tsx`; existing panels move under it unchanged in logic.
- `ProjectionNode` gains `blendMode`, `groupId`, `solo`; `ProjectState` gains `playlist` and `outputMode`. Older saved scenes fill in defaults on load.
- Blending applies via canvas `globalCompositeOperation` in `stage-renderer.ts`, so the warp shader and recording path are untouched.
- Shader/visualiser layers render to an offscreen canvas consumed by the existing media-fill path; imports are cached in IndexedDB with the scene.
- Audio uses `AnalyserNode`, camera uses `getUserMedia`; both live only in the studio/output page and are re-acquired per device rather than published.
- Published payload gains mode, playlist and prepared scenes, staying backwards compatible with the current live-output record and the password-free `/liveoutput` address.

## Verification

- Each tab reachable and usable at desktop and phone widths.
- Blend modes and opacity visibly change the output.
- One imported external visual animates in the output.
- Microphone and camera drive a layer, and playlist timing loops without the studio open.
