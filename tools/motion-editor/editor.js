"use strict";

const $ = function (id) { return document.getElementById(id); };
let project = null;
let selectedId = null;
let dirty = false;
let saveTimer = null;
let animationFrame = null;
let playStart = 0;
let playFrom = 0;

const currentScene = function () {
  return project ? project.scenes.find(function (item) { return item.id === selectedId; }) || project.scenes[0] : null;
};
const endTime = function () {
  return project ? Math.max(0.1, ...project.scenes.map(function (item) { return item.start + item.duration; })) : 0.1;
};
const clamp = function (value, min, max) { return Math.min(max, Math.max(min, Number(value))); };
const fmtTime = function (time) {
  const minutes = Math.floor(time / 60);
  const seconds = time - minutes * 60;
  return String(minutes).padStart(2, "0") + ":" + seconds.toFixed(2).padStart(5, "0");
};
function setStatus(message, kind) {
  $("saveStatus").textContent = message;
  $("saveStatus").className = "status " + (kind || "");
}
async function requestJson(path, options) {
  const response = await fetch(path, Object.assign({ cache: "no-store" }, options || {}));
  let body;
  try { body = await response.json(); } catch { body = {}; }
  if (!response.ok) {
    const extra = Array.isArray(body.details) ? body.details.join("\n") : body.error;
    throw new Error(extra || ("Request failed with status " + response.status));
  }
  return body;
}
async function loadProject() {
  setStatus("Loading project…");
  project = await requestJson("/api/project");
  selectedId = project.scenes[0].id;
  dirty = false;
  populateForm();
  setStatus("Project loaded", "ok");
}
async function saveProject() {
  if (!project) return;
  clearTimeout(saveTimer);
  setStatus("Saving…");
  try {
    await requestJson("/api/project", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project)
    });
    dirty = false;
    setStatus("Saved to project.json", "ok");
  } catch (error) {
    setStatus("Save failed: " + error.message, "error");
  }
}
function markDirty() {
  dirty = true;
  setStatus("Unsaved changes");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveProject, 700);
}
function populateSceneSelect() {
  const select = $("sceneSelect");
  select.replaceChildren();
  for (const item of project.scenes) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.id + " — " + item.props.headline.slice(0, 30);
    select.append(option);
  }
  select.value = selectedId;
}
function populateForm() {
  populateSceneSelect();
  const s = currentScene();
  if (!s) return;
  $("sceneIdLabel").textContent = s.id;
  $("eyebrow").value = s.props.eyebrow;
  $("headline").value = s.props.headline;
  $("highlight").value = s.props.highlight;
  $("subheadline").value = s.props.subheadline;
  $("accentColor").value = s.props.accentColor;
  $("fontSize").value = s.props.fontSize;
  $("x").value = s.props.x;
  $("y").value = s.props.y;
  $("maxWidth").value = s.props.maxWidth;
  $("showPanel").checked = s.props.showPanel;
  $("panelOpacity").value = s.props.panelOpacity;
  $("panelOpacityValue").value = Number(s.props.panelOpacity).toFixed(2);
  $("enterPreset").value = s.animation.enter.preset;
  $("enterDuration").value = s.animation.enter.duration;
  $("enterEase").value = s.animation.enter.ease;
  $("exitPreset").value = s.animation.exit.preset;
  $("exitDuration").value = s.animation.exit.duration;
  $("sceneStart").value = s.start;
  $("sceneDuration").value = s.duration;
  $("playhead").max = endTime().toFixed(2);
  $("x").max = String(Math.max(0, project.canvas.width - 160));
  $("y").max = String(Math.max(0, project.canvas.height - 100));
  $("maxWidth").max = String(project.canvas.width);
  $("canvasLabel").textContent = project.canvas.width + " × " + project.canvas.height;
  $("canvasBadge").textContent = (project.canvas.width > project.canvas.height ? "16:9" : "9:16") + " · " + project.canvas.width + " × " + project.canvas.height;
  renderPreview();
  renderKeyframes();
}

function addLines(target, value) {
  const lines = String(value).split("\n");
  lines.forEach(function (line, index) {
    if (index) target.append(document.createElement("br"));
    target.append(document.createTextNode(line));
  });
}
function addHighlightedText(target, text, highlight) {
  const source = String(text);
  const phrase = String(highlight || "");
  const index = phrase ? source.toLowerCase().indexOf(phrase.toLowerCase()) : -1;
  target.replaceChildren();
  if (index < 0) {
    addLines(target, source);
    return;
  }
  addLines(target, source.slice(0, index));
  const span = document.createElement("span");
  span.className = "preview-highlight";
  addLines(span, source.slice(index, index + phrase.length));
  target.append(span);
  addLines(target, source.slice(index + phrase.length));
}
function easeProgress(progress, ease) {
  const t = Math.max(0, Math.min(1, progress));
  if (ease === "power1.in") return t * t;
  if (ease === "power1.out") return 1 - Math.pow(1 - t, 2);
  if (ease === "power2.inOut") return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  if (ease === "power3.out") return 1 - Math.pow(1 - t, 3);
  if (ease === "back.out(1.4)") {
    const c1 = 1.4, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  return t;
}
function keyframeValues(scene, localTime) {
  const values = { offsetX: 0, offsetY: 0, scale: 1, opacity: 1 };
  const grouped = new Map();
  scene.animation.keyframes.slice().sort(function (a, b) { return a.time - b.time; }).forEach(function (frame) {
    if (!grouped.has(frame.property)) grouped.set(frame.property, []);
    grouped.get(frame.property).push(frame);
  });
  for (const pair of grouped.entries()) {
    const property = pair[0];
    const list = pair[1];
    let previousTime = 0;
    let previousValue = values[property];
    for (const frame of list) {
      if (localTime <= frame.time) {
        const span = frame.time - previousTime;
        const progress = span <= 0 ? 1 : Math.max(0, Math.min(1, (localTime - previousTime) / span));
        const eased = easeProgress(progress, frame.ease || "none");
        values[property] = previousValue + (frame.value - previousValue) * eased;
        break;
      }
      previousTime = frame.time;
      previousValue = frame.value;
      values[property] = frame.value;
    }
  }
  return values;
}
function entryProgress(scene, localTime) {
  const duration = scene.animation.enter.duration;
  if (scene.animation.enter.preset === "none" || duration <= 0) return 1;
  const amount = Math.max(0, Math.min(1, localTime / duration));
  return 1 - Math.pow(1 - amount, 3);
}
function renderPreview() {
  if (!project) return;
  const canvas = $("previewCanvas");
  canvas.replaceChildren();
  canvas.style.aspectRatio = project.canvas.width + " / " + project.canvas.height;
  const globalTime = Number($("playhead").value);
  const scaleX = canvas.clientWidth / project.canvas.width;
  const scaleY = canvas.clientHeight / project.canvas.height;
  let visibleCount = 0;

  for (const scene of project.scenes) {
    const localTime = globalTime - scene.start;
    if (localTime < 0 || localTime > scene.duration) continue;
    visibleCount += 1;
    const p = scene.props;
    const keyValues = keyframeValues(scene, localTime);
    const card = document.createElement("div");
    card.className = "preview-card";
    card.style.left = (p.x * scaleX) + "px";
    card.style.top = (p.y * scaleY) + "px";
    card.style.width = (Math.max(0, Math.min(p.maxWidth, project.canvas.width - p.x)) * scaleX) + "px";
    card.style.setProperty("--accent", p.accentColor);
    card.style.setProperty("--panel-alpha", p.showPanel ? p.panelOpacity : 0);
    const remaining = scene.duration - localTime;
    let exitOpacity = 1;
    if (scene.animation.exit.preset !== "none" && scene.animation.exit.duration > 0 && remaining < scene.animation.exit.duration) {
      exitOpacity = Math.max(0, remaining / scene.animation.exit.duration);
    }
    card.style.opacity = String(exitOpacity * keyValues.opacity);
    card.style.transform = "translate(" + (keyValues.offsetX * scaleX) + "px," + (keyValues.offsetY * scaleY) + "px) scale(" + keyValues.scale + ")";

    if (p.showPanel) {
      const panel = document.createElement("div");
      panel.className = "preview-panel";
      card.append(panel);
    }
    const content = document.createElement("div");
    content.className = "preview-content";
    const progress = entryProgress(scene, localTime);
    content.style.opacity = String(progress);
    let entryY = 0;
    let entryScale = 1;
    if (scene.animation.enter.preset === "slide-up") entryY = 38 * (1 - progress) * scaleY;
    if (scene.animation.enter.preset === "scale-in") entryScale = 0.94 + 0.06 * progress;
    content.style.transform = "translateY(" + entryY + "px) scale(" + entryScale + ")";
    if (p.eyebrow) {
      const eyebrow = document.createElement("div");
      eyebrow.className = "preview-eyebrow";
      eyebrow.textContent = p.eyebrow;
      content.append(eyebrow);
    }
    const rule = document.createElement("div");
    rule.className = "preview-rule";
    content.append(rule);
    const headline = document.createElement("h2");
    headline.className = "preview-headline";
    headline.style.fontSize = (p.fontSize * scaleX) + "px";
    addHighlightedText(headline, p.headline, p.highlight);
    content.append(headline);
    if (p.subheadline) {
      const subheadline = document.createElement("p");
      subheadline.className = "preview-sub";
      subheadline.textContent = p.subheadline;
      content.append(subheadline);
    }
    card.append(content);
    canvas.append(card);
  }
  if (!visibleCount) {
    const empty = document.createElement("div");
    empty.className = "preview-empty";
    empty.textContent = "No graphic at this time. Move the playhead onto a scene.";
    canvas.append(empty);
  }
  const active = currentScene();
  $("previewTitle").textContent = active ? active.props.headline : "Untitled scene";
  $("timeLabel").textContent = fmtTime(globalTime);
  $("halfMark").textContent = (Number($("playhead").max) / 2).toFixed(2) + "s";
  $("endMark").textContent = Number($("playhead").max).toFixed(2) + "s";
  renderTrack();
}
function renderTrack() {
  const track = $("sceneTrack");
  track.replaceChildren();
  if (!project) return;
  const total = endTime();
  const rowHeight = 27;
  track.style.height = Math.max(32, project.scenes.length * rowHeight + 6) + "px";
  project.scenes.forEach(function (scene, index) {
    const bar = document.createElement("button");
    bar.type = "button";
    bar.className = "track-scene" + (scene.id === selectedId ? " selected" : "");
    bar.style.left = (scene.start / total * 100) + "%";
    bar.style.width = (scene.duration / total * 100) + "%";
    bar.style.top = (4 + index * rowHeight) + "px";
    bar.textContent = scene.props.headline;
    bar.title = scene.id + " · " + scene.start + "s–" + (scene.start + scene.duration) + "s";
    bar.addEventListener("click", function () {
      selectedId = scene.id;
      $("playhead").value = String(scene.start);
      populateForm();
    });
    track.append(bar);
  });
}
function renderKeyframes() {
  const scene = currentScene();
  if (!scene) return;
  const list = $("keyframeList");
  list.replaceChildren();
  const frames = scene.animation.keyframes.slice().sort(function (a, b) { return a.time - b.time; });
  $("keyframeCount").textContent = frames.length + " key" + (frames.length === 1 ? "" : "s");
  if (!frames.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No keyframes. Place the playhead inside the selected scene and add one.";
    list.append(empty);
    return;
  }
  frames.forEach(function (frame) {
    const pill = document.createElement("div");
    pill.className = "kf-pill";
    pill.append(document.createTextNode(frame.time.toFixed(2) + "s · " + frame.property + "=" + frame.value + (frame.ease && frame.ease !== "none" ? " · " + frame.ease : "")));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = "Remove keyframe";
    remove.addEventListener("click", function () {
      scene.animation.keyframes = scene.animation.keyframes.filter(function (item) { return item !== frame; });
      markDirty();
      renderKeyframes();
      renderPreview();
    });
    pill.append(remove);
    list.append(pill);
  });
}
function bindField(id, setter, eventName, convert) {
  $(id).addEventListener(eventName || "input", function () {
    const scene = currentScene();
    if (!scene) return;
    const raw = $(id).type === "checkbox" ? $(id).checked : $(id).value;
    setter(scene, convert ? convert(raw) : raw);
    if (id === "panelOpacity") $("panelOpacityValue").value = Number(raw).toFixed(2);
    if (id === "headline") populateSceneSelect();
    markDirty();
    renderPreview();
  });
}
function uniqueSceneId() {
  let number = project.scenes.length + 1;
  let candidate;
  do {
    candidate = "headline-" + String(number).padStart(3, "0");
    number += 1;
  } while (project.scenes.some(function (scene) { return scene.id === candidate; }));
  return candidate;
}
function addScene(copyCurrent) {
  if (project.scenes.length >= 60) { alert("This MVP supports up to 60 scenes."); return; }
  const source = currentScene();
  const scene = JSON.parse(JSON.stringify(source));
  scene.id = uniqueSceneId();
  scene.start = endTime();
  scene.duration = source.duration;
  scene.props.headline = copyCurrent ? source.props.headline : "NEW HEADLINE";
  scene.props.highlight = copyCurrent ? source.props.highlight : "";
  scene.animation.keyframes = [];
  project.scenes.push(scene);
  selectedId = scene.id;
  markDirty();
  populateForm();
}
function stopPlayback() {
  if (animationFrame !== null) cancelAnimationFrame(animationFrame);
  animationFrame = null;
  $("playBtn").textContent = "Play preview";
}
function playFrame(now) {
  if (animationFrame === null) return;
  const current = playFrom + (now - playStart) / 1000;
  if (current >= endTime()) {
    $("playhead").value = String(endTime());
    renderPreview();
    stopPlayback();
    return;
  }
  $("playhead").value = String(current);
  renderPreview();
  animationFrame = requestAnimationFrame(playFrame);
}
function togglePlayback() {
  if (animationFrame !== null) {
    stopPlayback();
    return;
  }
  if (Number($("playhead").value) >= endTime()) $("playhead").value = "0";
  playFrom = Number($("playhead").value);
  playStart = performance.now();
  $("playBtn").textContent = "Pause preview";
  animationFrame = requestAnimationFrame(playFrame);
}
function bindControls() {
  bindField("eyebrow", function (s, v) { s.props.eyebrow = v; });
  bindField("headline", function (s, v) { s.props.headline = v; });
  bindField("highlight", function (s, v) { s.props.highlight = v; });
  bindField("subheadline", function (s, v) { s.props.subheadline = v; });
  bindField("accentColor", function (s, v) { s.props.accentColor = v; });
  bindField("fontSize", function (s, v) { s.props.fontSize = Number(v); });
  bindField("x", function (s, v) { s.props.x = Number(v); });
  bindField("y", function (s, v) { s.props.y = Number(v); });
  bindField("maxWidth", function (s, v) { s.props.maxWidth = Number(v); });
  bindField("showPanel", function (s, v) { s.props.showPanel = v; }, "change");
  bindField("panelOpacity", function (s, v) { s.props.panelOpacity = Number(v); });
  bindField("enterPreset", function (s, v) { s.animation.enter.preset = v; }, "change");
  bindField("enterDuration", function (s, v) { s.animation.enter.duration = Number(v); });
  bindField("enterEase", function (s, v) { s.animation.enter.ease = v; }, "change");
  bindField("exitPreset", function (s, v) { s.animation.exit.preset = v; }, "change");
  bindField("exitDuration", function (s, v) { s.animation.exit.duration = Number(v); });
  bindField("sceneStart", function (s, v) { s.start = Number(v); }, "change");
  $("sceneStart").addEventListener("change", function () {
    $("playhead").max = endTime().toFixed(2);
    renderPreview();
  });
  $("sceneDuration").addEventListener("change", function () {
    const s = currentScene();
    if (!s) return;
    s.duration = Number($("sceneDuration").value);
    s.animation.enter.duration = Math.min(s.animation.enter.duration, s.duration);
    s.animation.exit.duration = Math.min(s.animation.exit.duration, s.duration);
    s.animation.keyframes = s.animation.keyframes.filter(function (frame) { return frame.time <= s.duration; });
    $("playhead").max = endTime().toFixed(2);
    markDirty();
    populateForm();
  });
  $("sceneSelect").addEventListener("change", function () {
    selectedId = $("sceneSelect").value;
    const scene = currentScene();
    if (scene) $("playhead").value = String(scene.start);
    populateForm();
  });
  $("playBtn").addEventListener("click", togglePlayback);
  $("playhead").addEventListener("input", function () {
    renderPreview();
    const s = currentScene();
    if (s) {
      const localTime = Number($("playhead").value) - s.start;
      const value = localTime >= 0 && localTime <= s.duration ? keyframeValues(s, localTime)[$("kfProperty").value] : 0;
      $("kfValue").value = Number(value).toFixed(2);
    }
  });
  $("kfProperty").addEventListener("change", function () {
    const s = currentScene();
    const localTime = s ? Number($("playhead").value) - s.start : 0;
    const values = s && localTime >= 0 && localTime <= s.duration ? keyframeValues(s, localTime) : { offsetX: 0, offsetY: 0, scale: 1, opacity: 1 };
    $("kfValue").value = Number(values[$("kfProperty").value]).toFixed(2);
  });
  $("addKeyframeBtn").addEventListener("click", function () {
    const s = currentScene();
    if (!s) return;
    const time = Number($("playhead").value) - s.start;
    const property = $("kfProperty").value;
    let value = Number($("kfValue").value);
    if (!Number.isFinite(time) || time < 0 || time > s.duration) {
      alert("Move the playhead inside the selected scene first.");
      return;
    }
    if (!Number.isFinite(value)) {
      alert("Enter a numeric keyframe value.");
      return;
    }
    if (property === "scale") value = clamp(value, 0.01, 10);
    if (property === "opacity") value = clamp(value, 0, 1);
    value = clamp(value, -4000, 4000);
    s.animation.keyframes = s.animation.keyframes.filter(function (item) {
      return !(item.property === property && Math.abs(item.time - time) < 0.001);
    });
    s.animation.keyframes.push({ time: Number(time.toFixed(3)), property: property, value: value, ease: $("kfEase").value });
    markDirty();
    renderKeyframes();
    renderPreview();
  });
  $("saveBtn").addEventListener("click", saveProject);
  $("reloadBtn").addEventListener("click", async function () {
    if (dirty && !confirm("Discard unsaved changes and reload project.json?")) return;
    clearTimeout(saveTimer);
    try { await loadProject(); } catch (error) { setStatus(error.message, "error"); }
  });
  $("buildBtn").addEventListener("click", async function () {
    await saveProject();
    if (dirty) return;
    setStatus("Building composition…");
    try {
      const result = await requestJson("/api/build", { method: "POST" });
      setStatus("Built " + result.sceneCount + " scene(s). Run HyperFrames lint next.", "ok");
      alert("Composition generated at:\n" + result.outputDir + "\n\nNext, run HyperFrames lint and preview from that folder.");
    } catch (error) {
      setStatus("Build failed: " + error.message, "error");
    }
  });
  $("addSceneBtn").addEventListener("click", function () { addScene(false); });
  $("duplicateSceneBtn").addEventListener("click", function () { addScene(true); });
  $("removeSceneBtn").addEventListener("click", function () {
    if (project.scenes.length <= 1) {
      alert("A project must contain at least one scene.");
      return;
    }
    const s = currentScene();
    if (!confirm("Remove the scene “" + s.props.headline + "”?")) return;
    project.scenes = project.scenes.filter(function (item) { return item.id !== s.id; });
    selectedId = project.scenes[0].id;
    markDirty();
    populateForm();
  });
  $("copyPromptBtn").addEventListener("click", async function () {
    const prompt = $("promptInput").value.trim();
    if (!prompt) {
      $("copyStatus").textContent = "Write an editing request first.";
      return;
    }
    const instruction = "Update motion-graphics/project.json in my ShadowEditor repository. Apply this documentary motion-graphics change: " + prompt + "\nPreserve unrelated settings and other scenes. Use only supported headline-card properties and animation presets. Then run node tools/motion-graphics.mjs validate and node tools/motion-graphics.mjs build. Do not edit anything inside kit/. After building, tell me to run HyperFrames lint and preview.";
    try {
      await navigator.clipboard.writeText(instruction);
      $("copyStatus").textContent = "Instruction copied. Paste it into your coding agent opened in the ShadowEditor folder.";
      $("promptOutput").hidden = true;
    } catch {
      $("promptOutput").value = instruction;
      $("promptOutput").hidden = false;
      $("promptOutput").focus();
      $("promptOutput").select();
      $("copyStatus").textContent = "Clipboard was blocked. The instruction is shown below; copy it manually.";
    }
  });
}
window.addEventListener("beforeunload", function (event) {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
(async function init() {
  try {
    await loadProject();
    bindControls();
  } catch (error) {
    setStatus("Load failed: " + error.message, "error");
  }
})();
