# Side-Projection Mapping Suite — MVP

A single-page dark studio app for extreme off-axis projection mapping: load a wall photo, draw projection windows over wall features, assign media, and send a perspective-corrected (homography-warped) render to a projector window.

## What gets built

### 1. Dual-view architecture
- Editor at `/` (replaces the placeholder page), projector output at `/projector`.
- "Launch Projector Window" opens `/projector` in a popup; state syncs live over `BroadcastChannel` (node geometry, media assignments, corner pins, sliders).
- Fallback: if `BroadcastChannel` is unavailable or the popup is blocked, a split-screen toggle renders the projector viewport inline beside the editor, fully functional on one page.

### 2. Editor stage (orthorectified)
- Drag-and-drop image dropzone sets the wall reference photo as canvas underlay.
- Opacity slider (0–100%) plus visibility toggle for the photo.
- Aspect-ratio bounding box driven by header controls for wall size (meters) and output resolution.

### 3. Mapping layer manager (React-Konva)
- Add rectangular or polygon projection nodes; drag, scale, rotate with transform handles.
- Layer hierarchy list: select, rename, reorder, toggle visibility, delete.
- Per-node media assignment: uploaded video loop, static image, or solid color fill.

### 4. Homography warp + brightness engine (Three.js / WebGL)
- Projector viewport renders the editor stage as a live texture on a plane.
- Interactive 4-corner pin handles (TL, TR, BR, BL) on the projector view.
- `homography.ts` computes the 3x3 matrix via DLT with zero-division guards; falls back to identity until 4 valid corners exist, never emits NaN.
- Custom GLSL fragment shader applies the inverse warp plus a horizontal brightness-gain ramp (slider) to compensate for light falloff across the 2m–8m throw.
- Shader fallback: if compilation fails, warp via a subdivided `PlaneGeometry` with transformed vertices.

### 5. Effects and scheduler (last tier)
- Glow/bloom toggle with intensity for text/overlay nodes.
- Lightweight floating particle generator (music-note graphics) as an optional node type.
- Simple scheduler: trigger a node's animation every X seconds.

## Layout and style
- Dark studio theme (deep slate surfaces, light text, subtle borders) defined as semantic design tokens, not hardcoded colors.
- Three panels: left tool palette + asset uploader + layer stack; center interactive stage; right inspector (node transform, media mapping, glow, falloff). Header holds dimension controls and the projector launch button.

## Technical notes
- Adds `react-konva`/`konva` and `three` as dependencies. Konva and Three are browser-only, so both stage and viewport load through `React.lazy` behind `ClientOnly`; shared node types/state live in a browser-safe module.
- Files: `src/components/EditorStage.tsx`, `src/components/ProjectorViewport.tsx`, `src/components/panels/*`, `src/lib/homography.ts`, `src/lib/projection-store.ts` (state + BroadcastChannel sync), `src/routes/index.tsx`, `src/routes/projector.tsx`.
- Render loops use `requestAnimationFrame` with refs; no per-frame React state updates.
- Media and wall photos stay client-side as object URLs — no backend, no uploads, session-only persistence.
- Each route gets its own head metadata (title, description, og/twitter tags).
