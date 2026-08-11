# Obie-Mapper

# PRODUCT SPECIFICATION & MVP PROMPT: Side-Projection Mapping Web Suite

## 1. Context & Purpose

Build a high-performance, single-page web application for extreme off-axis projection mapping (shooting across a wall at a 2m to 8m perspective throw). The app allows users to upload a dead-center photo of a wall as a digital twin background, draw interactive projection windows over specific wall objects (e.g., shields, speakers, text), map video/image media layers to those windows, and output a perspective-corrected (Homography warped) WebGL render to a secondary projector display.

---

## 2. MVP Core Features (Strict Build Order)

To preserve AI credits and ensure a functional MVP out-of-the-box, build features strictly in this priority order:

1. **Dual-View & Screen Communication Architecture:**

   - Editor View (Main UI) and Projector Output View (Secondary Window).

   - Use `BroadcastChannel` API to send real-time canvas texture updates and corner-pin positions between windows.

2. **Orthorectified Editor Stage:**

   - Image File Dropzone to set a wall reference photo (`wall_bg.jpg`) as an interactive canvas background underlay.

   - Opacity slider (0% to 100%) and visibility toggle for the background photo.

3. **Interactive 2D Mapping Layer Manager (React-Konva):**

   - Ability to draw/add Rectangular and Polygon Projection Nodes over wall features.

   - Drag, scale, and rotate transformation handles for placed nodes.

   - Media assignment dropdown per node: Allow users to assign video loops, static images, or color fills to specific nodes.

4. **Homography Warping & Brightness Correction Engine (Three.js / WebGL):**

   - Interactive 4-Corner Pinning Grid on the Projector Output window to map top-left, top-right, bottom-right, and bottom-left bounds.

   - Compute 3x3 Homography Matrix (Direct Linear Transformation / DLT algorithm) mapping Editor 2D space to Projector perspective space.

   - Custom GLSL Fragment Shader: Include a horizontal brightness gain slider to compensate for inverse-square light decay (dimming near 2m side, boosting far 8m side).

5. **MVP Visual Effects & Scheduler (Nice-to-Have Tier):**

   - Single CSS/Shader Glow/Bloom effect for text overlays.

   - Basic floating particle generator for music note graphics.

   - Simple time-based trigger scheduler (e.g., trigger node animation every X seconds).

---

## 3. UI Style & Design Guidance

- **Theme:** Dark mode studio UI (`bg-slate-900`, `text-slate-100`, `border-slate-800`).

- **Layout:** Three-panel interface:

  - *Left Sidebar:* Tool palette (Add Node, Asset Uploader, Layer Hierarchy stack).

  - *Center Canvas:* Interactive orthographic stage with aspect-ratio bounding box.

  - *Right Inspector:* Selected Node properties, Media mapping, Glow effects, and Falloff brightness sliders.

  - *Header:* Screen dimension controls (Meters/Resolution) and a prominent "Launch Projector Window" action button.

---

## 4. Technical Constraints & Code Efficiency Guidelines

- **Frameworks:** React, Tailwind CSS, Lucide-React icons, React-Konva (for Editor), Three.js (for WebGL Output).

- **Credit-Saving Execution Rules:**

  - Write modular, lightweight components (`src/components/EditorStage.jsx`, `src/components/ProjectorViewport.jsx`, `src/utils/homography.js`).

  - Do NOT rewrite entire files for simple state tweaks. Use localized edits.

  - Implement WebGL animation loops using `requestAnimationFrame` with `useRef()` rather than putting heavy render ticks into React `useState()` loops.

---

## 5. Contingencies & Self-Healing Protocol

If technical limitations arise during execution, apply these automated fallbacks:

- **If `BroadcastChannel` fails or is blocked:** Fall back to a unified split-screen toggle view (`[Editor Mode] | [Projector Viewport]`) on a single page so the application remains fully functional without requiring multi-screen popup permissions.

- **If Complex GLSL Shader compilation fails:** Fall back to Three.js `PlaneGeometry` with vertex matrix transformations using standard CSS/WebGL matrix3d warps.

- **If Matrix Mathematics produce NaN values:** Ensure the DLT algorithm in `homography.js` includes zero-division guards and defaults to an identity matrix `[1,0,0, 0,1,0, 0,0,1]` until 4 corner points are selected.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://obie-mapper-2.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cb45c24e-fcba-45ea-962c-e7a1fe9bf9d8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
