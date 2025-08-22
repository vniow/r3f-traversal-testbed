
# Woscope — Audiovisual Architecture Spec

**Purpose:** Document the architecture and implementation of the `woscope` oscilloscope-emulator project (https://github.com/m1el/woscope) and its supporting blog post (https://m1el.github.io/woscope-how/). The goal is to give a concise, developer-focused overview of how the system is organized, how audio data flows into the visual pipeline, and how the WebGL shaders produce the oscilloscope-style output.

---

**High-level summary**
- Woscope is a browser-based oscilloscope emulator implemented with Web Audio API for audio capture/playback and WebGL for rendering. It can render both preloaded audio files and live audio input from a media element. The rendering pipeline uses raw audio samples packed into WebGL buffers and drawn via custom GLSL shaders. Optional bloom/blur passes are applied using offscreen framebuffers and multiple render targets.

**Primary repository files (important ones)**
- `index.js` — single-file library entry: initializes WebGL, Web Audio, shader programs, audio analysis / playback handling, and the main draw loop. Exposes the `woscope(config)` public function.
- `shaders/` — GLSL shader sources used by the rendering pipeline:
	- `vsLine.glsl` / `fsLine.glsl` — vertex + fragment shaders for drawing the waveform beam segments.
	- `vsBlurTranspose.glsl` / `fsBlurTranspose.glsl` — shaders used for separable blur (bloom) passes.
	- `vsOutput.glsl` / `fsOutput.glsl` — final textured output shader.
	- `vsProgress.glsl` / `fsProgress.glsl` — progress / loader shader used while audio assets are loading.
- `dist/` — built artifacts for easy demo embedding (pre-built `woscope.js`).
- `index.html` / `demo/` — demo pages showing example usage with an `<audio>` element and a `<canvas>` element.

---

**Public API / Integration**
- `woscope(config)` — primary function, accepts a config object containing:
	- `canvas`: HTMLCanvasElement where rendering occurs.
	- `audio`: HTMLMediaElement (audio element) used for playback when not using `audioUrl` or `live` mode.
	- `audioUrl`: optional direct URL to an audio file (xhr + decode used if provided).
	- `callback(errorOrCtx)`: called when initial setup or loading completes; receives context object.
	- `live`: if true, the library will connect to the audio element via `createMediaElementSource` and use analyser/scriptProcessor for live visualization.
	- `sweep`, `swap`, `invert`, `color`, `color2`, `bloom`, `lineSize`, `swap` — flags and parameters affecting rendering and beam behaviour.

Return value: a `ctx` object with many runtime internals (GL context, shader programs, framebuffers, analyser/script nodes, utility methods and `destroy()` function).

---

**Audio handling**
- Uses Web Audio API. On first run it creates (or reuses) an AudioContext.
- Two main audio input modes:
	1. Static / preloaded audio: uses XHR to fetch an audio file into an ArrayBuffer, decodes it via `audioCtx.decodeAudioData` and then `prepareAudioData(ctx, buffer)` extracts left/right Float32Array channel buffers used for offline stepping during playback.
	2. Live audio: uses `createMediaElementSource(audio)` and either an `AnalyserNode` or a `ScriptProcessorNode` depending on browser capabilities (`getFloatTimeDomainData` availability). The analyser mode uses `analyser.getFloatTimeDomainData()` to read time-domain samples. The scriptProcessor mode uses `onaudioprocess` to append samples into circular buffers.
- Channel handling:
	- Audio is split into left/right using a channel splitter when using analysers to ensure consistent behaviour across browsers.
	- When preparing buffers, `nSamples` (default 2048) determines the amount of samples the visual pipeline consumes each frame.

---

**Data path into WebGL**
- Samples are transformed into interleaved vertex data in `loadChannelsInto`, writing into typed Float32Array `scratchBuffer` with a repeating pattern to represent quad vertices for the beam segments.
- The code prepares several WebGL buffers:
	- `quadIndex` buffer: indices used to pick which vertex in a quad we are rendering.
	- `vertexIndex` element buffer: triangles that cover the sample segments.
	- `vbo` / `vbo2`: vertex buffers containing packed sample points for waveform segments.
- The draw loop (`draw`) calls `drawLine` which binds appropriate shader programs and vertex attributes to render the waveform as many connected segments. Each segment is rendered as a quad (start + end vertices) then the fragment shader computes the beam intensity and falloff per-pixel.

---

**Rendering pipeline & shaders**
- Beam drawing (`vsLine.glsl` / `fsLine.glsl`):
	- The vertex shader receives per-segment start/end positions and expands each segment into a four-vertex quad; the shader computes tangent and normal to offset the beam according to `uSize` (beam thickness). The fragment shader computes an analytical Gaussian-profiled beam intensity along the segment length for a smooth glowing line.
	- The fragment shader uses `uSize`, `uIntensity`, and `uColor` to compute final RGBA color output for the beam; special-case handling for very short segments avoids numerical issues.
- Bloom / blur pipeline:
	- When `bloom` is enabled the code renders the beam to an offscreen framebuffer (`ctx.lineTexture`), generates mipmaps, then runs a separable blur pass (`fsBlurTranspose.glsl`) across downscaled textures to produce a glow texture.
	- The final composition draws the original line texture and the blurred texture on top (with alpha) using `fsOutput.glsl` to composite onto the default framebuffer.
- Output shader (`fsOutput.glsl`): minor wrapper to set alpha before final draw.

---

**Performance considerations**
- The renderer batches samples into large vertex buffers to reduce per-frame CPU→GPU overhead. It uses typed arrays and reuses buffers when possible.
- `AnalyserNode` mode is preferred where supported, because `ScriptProcessorNode` has higher latency and may be less stable under load.
- Bloom passes use mipmaps and downscaling to reduce expensive full-resolution blur costs.

---

**Integration and usage patterns**
- Typical demo embeds a `<canvas>` and an `<audio>` element. Example in README demonstrates calling `woscope({ canvas, audio, callback })` and playing the audio in the callback.
- For live microphone or element-driven visuals, pass `live: true` and the library will connect to the audio element and stream samples to the renderer.

---

**Build & dev**
- Dev commands included in README: `npm install`, `npm run demo`, `npm run build` (lint + build dist). The `dist` folder contains prebuilt assets for embedding.
- The library uses `glslify` to embed shader sources at build time.

---

**Notes and recommendations for maintainers**
- Consider migrating to Web Audio `AudioWorklet` (instead of `ScriptProcessor`) for lower-latency and more robust live sample handling in modern browsers.
- Add explicit handling for canvas DPI / devicePixelRatio when creating framebuffers: currently the framebuffer width/height defaults to 1024 and is not automatically matched to canvas CSS size — adding proper resizing would improve output crispness on HiDPI screens.
- The shader and rendering pipeline are compact and performant; adding unit tests is non-trivial but a small harness that verifies buffer sizes, sample routing, and presence of GL extensions would be helpful.

---

References
- Project repo: https://github.com/m1el/woscope
- Blog post / explanation: https://m1el.github.io/woscope-how/

