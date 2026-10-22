import test from "node:test";
import assert from "node:assert/strict";
import { readProject, validateProject, renderComposition, htmlEscape } from "../tools/motion-graphics.mjs";

test("starter project validates", () => {
  assert.deepEqual(validateProject(readProject()), []);
});

test("rejects unsafe scene IDs and invalid colors", () => {
  const project = readProject();
  project.scenes[0].id = "../bad";
  project.scenes[0].props.accentColor = "red;position:fixed";
  const errors = validateProject(project);
  assert.ok(errors.some(error => error.includes(".id")));
  assert.ok(errors.some(error => error.includes("accentColor")));
});

test("rejects duplicate scene IDs", () => {
  const project = readProject();
  project.scenes.push(structuredClone(project.scenes[0]));
  assert.ok(validateProject(project).some(error => error.includes("must be unique")));
});

test("legacy project without layers remains valid", () => {
  const project = readProject();
  delete project.scenes[0].layers;
  assert.deepEqual(validateProject(project), []);
});

test("validates independent text and rectangle layers", () => {
  const project = readProject();
  project.scenes[0].layers = [
    { id: "layer-001", type: "rect", name: "Accent bar", start: 0.2, duration: 2, x: 100, y: 100, width: 600, height: 18, opacity: 0.9, rotation: -2, scale: 1, fill: "#E52B32", visible: true, borderRadius: 2 },
    { id: "layer-002", type: "text", name: "Callout", text: "CASE FILE", start: 0.5, duration: 2.5, x: 140, y: 160, width: 500, height: 90, opacity: 1, rotation: 0, scale: 1, fill: "#FFFFFF", visible: true, fontSize: 48, fontWeight: 800, textAlign: "left" }
  ];
  assert.deepEqual(validateProject(project), []);
});

test("rejects unsafe or out-of-scene visual layer settings", () => {
  const project = readProject();
  project.scenes[0].layers = [
    { id: "../unsafe", type: "text", name: "Bad", text: "x", start: 4, duration: 1, x: 0, y: 0, width: 100, height: 100, opacity: 1, rotation: 0, scale: 1, fill: "red", visible: true, fontSize: 40, fontWeight: 800, textAlign: "left" }
  ];
  const errors = validateProject(project);
  assert.ok(errors.some(error => error.includes(".id")));
  assert.ok(errors.some(error => error.includes("start + duration")));
  assert.ok(errors.some(error => error.includes(".fill")));
});

test("generated composition preserves layered overlays and escapes layer text", () => {
  const project = readProject();
  project.scenes[0].layers = [
    { id: "label-001", type: "text", name: "Evidence label", text: "<script>nope</script>", start: 0.5, duration: 1.2, x: 100, y: 120, width: 500, height: 80, opacity: 0.8, rotation: 4, scale: 1, fill: "#FFFFFF", visible: true, fontSize: 48, fontWeight: 800, textAlign: "left" },
    { id: "bar-001", type: "rect", name: "Bar", start: 0, duration: 4.2, x: 100, y: 220, width: 500, height: 20, opacity: 1, rotation: 0, scale: 1, fill: "#E52B32", visible: true, borderRadius: 0 }
  ];
  const output = renderComposition(project);
  assert.match(output.html, /class="se-layer clip se-layer-text" data-start="0.5" data-duration="1.2"/);
  assert.ok(output.html.includes("&lt;script&gt;nope&lt;/script&gt;"));
  assert.ok(output.html.indexOf('id="layer-headline-001-label-001"') < output.html.indexOf('id="layer-headline-001-bar-001"'));
});

test("rejects keyframes outside the scene duration", () => {
  const project = readProject();
  project.scenes[0].animation.keyframes.push({ time: 99, property: "offsetX", value: 10 });
  assert.ok(validateProject(project).some(error => error.includes(".time")));
});

test("rejects unsupported per-keyframe easing", () => {
  const project = readProject();
  project.scenes[0].animation.keyframes[0].ease = "javascript:alert(1)";
  assert.ok(validateProject(project).some(error => error.includes(".ease is unsupported")));
});

test("preserves selected per-keyframe easing in generated GSAP tweens", () => {
  const project = readProject();
  project.scenes[0].animation.keyframes[0].ease = "power3.out";
  const output = renderComposition(project);
  assert.match(output.html, /ease:"power3\.out"/);
});

test("escapes markup in headline and subtitle", () => {
  assert.equal(htmlEscape('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  const project = readProject();
  project.scenes[0].props.headline = "<script>not markup</script>";
  project.scenes[0].props.highlight = "";
  const output = renderComposition(project);
  assert.ok(output.html.includes("&lt;script&gt;not markup&lt;/script&gt;"));
  assert.ok(!output.html.includes('<h1 class="doc-headline"><script>'));
});

test("generates a timed composition with its exact paused-timeline key", () => {
  const output = renderComposition(readProject());
  assert.match(output.html, /data-composition-id="shadoweditor-documentary-headline"/);
  assert.match(output.html, /data-start="0" data-duration="4\.2" data-track-index="1"/);
  assert.match(output.html, /window\.__timelines\["shadoweditor-documentary-headline"\] = tl/);
  assert.match(output.html, /gsap\.timeline\(\{ paused: true \}\)/);
  assert.equal(output.duration, 4.2);
});

import { readFileSync } from "node:fs";

test("visual editor playback button is wired", () => {
  const editorSource = readFileSync(new URL("../tools/motion-editor/editor.js", import.meta.url), "utf8");
  assert.match(editorSource, /\$\("playBtn"\)\.addEventListener\("click", togglePlayback\)/);
});

test("visual editor exposes per-keyframe easing and applies it in preview", () => {
  const editorSource = readFileSync(new URL("../tools/motion-editor/editor.js", import.meta.url), "utf8");
  const editorHtml = readFileSync(new URL("../tools/motion-editor/index.html", import.meta.url), "utf8");
  assert.match(editorHtml, /id="kfEase"/);
  assert.match(editorSource, /easeProgress\(progress, frame\.ease \|\| "none"\)/);
  assert.match(editorSource, /value: value, ease: \$\("kfEase"\)\.value/);
});
