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

test("rejects keyframes outside the scene duration", () => {
  const project = readProject();
  project.scenes[0].animation.keyframes.push({ time: 99, property: "offsetX", value: 10 });
  assert.ok(validateProject(project).some(error => error.includes(".time")));
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
