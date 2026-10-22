# Documentary Motion Graphics MVP

This module is the first ShadowEditor extension prototype. It adds a documentary headline-card composition with prompt-based edits and manual controls, using the same validated JSON project file as the source of truth.

## Requirements

- Node.js 22 or later
- Run `node setup.mjs` from the repository root first; this installs the pinned Herk Edit Kit into the local, gitignored `kit/` folder.

## Open the visual editor

From the ShadowEditor repository root:

```sh
node tools/motion-editor-server.mjs
```

Open http://127.0.0.1:4177. The server listens on loopback only. It does not call an external AI service. Use **Copy AI instruction** to copy a request to your coding agent, then ask that agent to update `motion-graphics/project.json`. Reload the editor to see agent-made changes.

## Build the HyperFrames project

```sh
node tools/motion-graphics.mjs validate
node tools/motion-graphics.mjs build
cd kit/video-projects/shadoweditor-documentary-headline
npx hyperframes lint
node ../../scripts/preflight.mjs .
npx hyperframes preview
npx hyperframes render --quality draft --output renders/headline-draft.mp4
```

The generated project is ignored with the rest of `kit/`. The build command refuses to overwrite an existing project unless its `index.html` has this module's generated marker.

## Supported MVP

- Multiple timed headline-card scenes.
- Eyebrow, headline, one highlighted phrase, and supporting line.
- Accent color, font size, placement, max width, and translucent panel.
- Entrance and exit presets.
- Basic local keyframes for X offset, Y offset, scale, and opacity.
- One local editor server shared by AI prompt changes and manual adjustments.

The preview inside the visual editor is an approximation. HyperFrames lint, Studio preview, and a draft render remain required before using a composition in a final video.
