# ShadowEditor Motion Graphics Roadmap

## Product vision

ShadowEditor should grow from an AI-assisted video editor into a local-first, AI-directed motion-design studio with the breadth of techniques people commonly use in Adobe After Effects: layered compositing, typography, 3D-perspective animation, motion blur, flash-cut transitions, motion tracking, subject cutouts that follow movement, and layered paper/collage animation.

The goal is comparable creative workflows for selected techniques, not a claim that one MVP can fully replace every After Effects feature. Each capability must be implemented, rendered, and visually tested before it is advertised as supported.

## Current state: prototype, not the destination

The current motion-graphics MVP supports a limited headline-card project model plus optional static text/rectangle overlays per scene:
- Eyebrow, headline, highlighted phrase, and subtitle.
- Position, size, accent color, and a dark panel.
- A small set of entrance/exit presets.
- Basic keyframes for offset, scale, and opacity.
- A local browser inspector and a shared `motion-graphics/project.json`.
- Optional text/rectangle layers with scene-local timing and editable transforms; projects without layers remain compatible.
- HyperFrames/GSAP generation and draft rendering.

The browser preview is an approximation. HyperFrames lint, preflight, rendered-video inspection, and user review remain required. Do not describe the prototype as a complete After Effects replacement.

## Target architecture

### 1. AI director and operation layer

Claude Code (or another configured coding agent) interprets natural-language instructions and makes validated edits to a canonical project model. It should plan before applying destructive or complex changes, explain which layers/effects will change, and render review drafts.

The browser editor provides direct manipulation of the same model. It must not maintain a separate animation state that diverges from AI edits.

Groq's existing `GROQ_API_KEY` is for the transcription workflow where configured. It does not itself implement visual effects or motion tracking. Keep transcription credentials in the ignored local `.env`; never hardcode, print, or commit them.

### 2. Layered composition model

Evolve the single headline-scene schema into a versioned project graph that can represent:
- Composition settings: width, height, frame rate, duration, color/background options.
- Ordered layers: video, image, text, vector/shape, matte/cutout, camera, and nested composition.
- Parent/child relationships, anchor points, 2D and 3D transforms, opacity, blending, masks, and visibility.
- Keyframes with interpolation/easing, markers, effect stacks, and named presets.
- Media references and derived assets (for example, alpha-matted subject images and tracking data).
- Stable IDs, schema validation, migrations, and undoable edits.

Keep compatibility with the current headline-card schema during migration, or provide an explicit converter so existing projects are not silently broken.

### 3. Rendering and preview engine

Retain HyperFrames/GSAP for the capabilities they serve well: timed compositions, typography, shapes, transitions, and procedural motion graphics. Test each new composition against the pinned Herk Edit Kit/HyperFrames revision before depending on undocumented behavior.

For true 3D scenes, evaluate a local WebGL renderer (for example, Three.js) as an isolated renderer module. CSS 3D transforms can cover simpler 2.5D moves, but should not be presented as a full 3D camera system.

Create a renderer capability matrix and a small golden-scene test suite. Keep third-party libraries pinned, preserve their licenses, and bundle needed assets locally where possible.

### 4. Target feature tracks

#### A. Motion-design fundamentals
- Multi-layer timeline and layer ordering.
- Text/shape animation, reusable presets, markers, snapping, easing/curve editor.
- Flash cuts, whip/zoom transitions, speed changes, impact frames, controlled light leaks and overlays.
- Templates for lower thirds, titles, stats, maps, evidence cards, and paper/collage scenes.

Flash effects should be deliberately timed and restrained. Avoid intense, repeated full-frame flicker; provide a reduced-flash alternative.

#### B. 2.5D and 3D perspective
- Layer depth, anchor/pivot controls, camera position/rotation, perspective, parallax, and nested scenes.
- Start with 2.5D image planes and camera moves, then evaluate true 3D geometry, lights, and material support.
- Provide a viewport/grid, camera presets, and keyframeable transforms.
- Acceptance test: a reproducible camera move renders with correct layer depth, occlusion, and no unexpected clipping.

#### C. Motion blur
- Define shutter angle/duration and a consistent frame-time model.
- First verify whether the pinned renderer has suitable native support. If not, prototype a renderer-level temporal-sampling or post-processing method and measure its render cost.
- Do not fake motion blur with a simple static blur filter when the requested effect must follow motion.
- Acceptance test: compare sharp and blurred versions of the same fast move at output frame rate; check for ghosting and timing artifacts.

#### D. Motion tracking
- Begin with 2D point/planar tracking and tracking-data import/export.
- Evaluate an OpenCV-based local tracking helper for feature/planar tracking, with explicit confidence values and manual correction points.
- Store tracked points/transforms in project data and allow a graphic layer to attach to a track.
- Later investigate camera-motion estimation and more advanced 3D camera tracking.
- Acceptance test: track an object/plane in a supplied test clip, attach a label or graphic, and verify drift over the full shot.

#### E. Subject/image cutout and cutout tracking
- Define a pluggable local segmentation/matting backend. Make model downloads and hardware needs explicit; do not silently call paid cloud services.
- Produce a source-aligned alpha matte or RGBA asset, track temporal consistency, and permit user corrections when the mask fails.
- Attach the cutout to the tracked transform so the subject can pass in front of/behind graphic layers.
- Acceptance test: a moving subject remains reasonably separated from the background over the clip, with edge and temporal artifacts reviewed.

#### F. Paper, collage, and cutout animation
- Layered scans/photos with controllable pivot points, paper textures, shadows, masks, depth, and 2.5D rotations.
- Rigged joints/parenting and reusable reveal, unfold, tear, slide, pin, and page-turn presets.
- Optional deformation/mesh effects only after a simpler layered rig is reliable.
- Acceptance test: a multi-layer paper scene can be rigged, keyframed, previewed, and rendered from the same project data.

## Suggested implementation phases

1. **Stabilize current MVP.** Fix and test playback, save/reload, scene timing, and project generation. Review a rendered draft and preserve a baseline test project.
2. **Expand the layer/timeline model.** Add image and vector layers, a unified track view, per-layer keyframe CRUD, interpolation/easing, and undo/redo.
3. **Expand 2D motion presets.** Implement flash cuts, kinetic type, whip/zoom transitions, paper-card movements, and reusable documentary templates with render tests.
4. **Build 2.5D depth and camera.** Add layer depth and camera transform support with a validated renderer prototype.
5. **Implement motion blur.** Choose native or renderer-level temporal sampling based on measured support and render quality.
6. **Add 2D/planar tracking.** Track, inspect, correct, and bind graphics to tracked surfaces/points.
7. **Add subject cutout and matte tracking.** Integrate a local segmentation/matting backend with review and manual correction.
8. **Expand true 3D and advanced compositing.** Add only after the preceding layers and data model are dependable.

Each phase should end with a demo project, automated tests, a draft render, and a known-limitations section before moving to the next.

## Non-negotiable engineering rules

- Never claim an After Effects-like capability is supported until there is a reproducible test and a rendered example.
- Keep user footage, keys, transcripts, and rendered projects local and ignored by Git by default.
- Use the existing pinned Herk Edit Kit as a dependency; do not casually patch files under `kit/`.
- Avoid silently introducing paid APIs or uploading footage for segmentation/generation.
- Keep AI editing and manual editing on one canonical project model.
- Validate inputs, escape text, use stable IDs, and make complex/destructive actions reviewable.
- Test the actual exported frames/video; lint alone does not prove visual quality.

## Definition of the long-term goal

A user can give a Tagalog/Taglish prompt, the agent constructs a layered animation plan, the visual editor exposes all key properties and keyframes, and the same project renders deterministically to a reviewable video. Each effect track is added incrementally and verified rather than implied by the product vision alone.
