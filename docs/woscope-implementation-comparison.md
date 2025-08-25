# Woscope implementation comparison — r3f-traversal-testbed vs target woscope

Date: 2025-08-24

Purpose

- Produce a focused, developer-oriented comparison of the current implementation in this repo (r3f-traversal-testbed) and the target project you referenced (m1el/woscope).
- Document the exact data structures we use, how vertex geometry is produced from audio samples, and how timing/sample mapping is performed.
- Provide a checklist of exact points to compare against the upstream woscope repository and propose concrete next steps and tests to reach sample-accurate parity.

Note on the remote project

- This document now incorporates (A) a focused inspection of this repo, (B) the project's audiovisual spec (`docs/woscope-audiovisual-spec.md`) and (C) concrete excerpts taken from the upstream `m1el/woscope` implementation (vertex generation, draw loop and shaders). Where I reference upstream code I include the relevant behavior observed in those excerpts.

---

## Quick summary (local repo)

- The repo implements a stereo oscilloscope-like visualization.
- Audio is decoded into a full buffer (`useAudioBuffer`) and also routed through an AudioContext + ChannelSplitter + two Analysers (`useAudioAnalyser`) for low-latency, per-frame visuals.
- `createVertexDataFromAudio(...)` (in `src/utils/woscopeVertexUtils.ts`) converts sequences of audio samples into vertex/index buffers suitable for quad-based beam rendering.
- `WoscopeRenderer` constructs/update BufferGeometry attributes per-frame and uses a custom ShaderMaterial (shaders in `src/shaders/woscopeShaders.ts`) to render a Gaussian beam-like oscilloscope line.
- The renderer now supports three rendering inputs: live analyser samples, decoded-buffer slices (sample-accurate start sample), and a frozen `snapshot` captured on pause/seek.

Key local improvements implemented since the first draft

- Switched live rendering to prefer an `AnalyserNode`-based pull path that writes directly into preallocated Float32Array views (zero-allocation pull).
- Preallocated and reused typed arrays and `THREE.BufferAttribute` backing arrays to avoid per-frame allocations and reduce GC pressure.
- Implemented snapshot-on-pause (capture decoded-buffer window or analyser fallback) and draw-count-based intensity normalization to avoid perceived dimming when paused.

---

## Files & responsibilities (local)

- `src/hooks/useAudioBuffer.ts`

  - Fetches and decode audio via shared AudioContext, produces `audioData` with shape:
    ```ts
    interface AudioBufferData {
      leftChannel: Float32Array;
      rightChannel: Float32Array;
      sampleRate: number;
      duration: number;
    }
    ```
  - Exposes `audioData` for renderer to use for deterministic sample extraction.

- `src/hooks/useAudioAnalyser.ts`

  - Creates a `MediaElementAudioSource` attached to the <audio> element.
  - Builds a `ChannelSplitterNode` and two `AnalyserNode`s (left/right). Reuses a shared AudioContext.
  - Allocates `dataLeftRef` and `dataRightRef` buffers (sized to analyser.fftSize) and `pull()` writes analyser time-domain samples directly into these buffers and returns subarray(0, nSamples).
  - This is the live path for per-frame visuals.

  Notes from upstream: the original `woscope` also splits channels and creates two `AnalyserNode`s (fftSize=2048) and uses `analyser.getFloatTimeDomainData()` in the live path (see upstream `initAnalysers` + `loadWaveLive`). Our hook behaviour mirrors that design but uses zero-allocation writes into persistent buffers.

- `src/utils/woscopeVertexUtils.ts`

  - Exports `WoscopeVertexData` shape:
    ```ts
    export interface WoscopeVertexData {
      vertices: Float32Array; // interleaved floats [x,y,quadIndex,segmentT, ...]
      indices: Uint16Array; // 6 indices per segment (two triangles per quad)
      numSegments: number;
    }
    ```
  - `createVertexDataFromAudio(left, right, startSample, config)`:

    - `config` includes: `nSamples`, `timeScale`, `amplitudeScale`, `sweep`, `swap`.
    - It clamps to available samples and sets `numSegments = actualSamples - 1`.
    - Each segment is converted into 4 vertices (quad), each vertex stores 4 floats: `[x, y, quadIndex, segmentT]`.
    - Indices layout is `[{base}+0,{base}+1,{base}+2, {base}+1,{base}+2,{base}+3]` for each segment.

    Notes from upstream: upstream packs per-segment data into a `scratchBuffer` and uploads `vbo`/`vbo2` for sweep/swap modes. Upstream's `makeQuadIndex` and `makeVertexIndex` constructs the sequential per-vertex quad-index buffer and the element index buffer; the triangle ordering is the same 6-indices-per-quad pattern we use. The upstream pipeline writes start/end sample positions (aStart/aEnd) and a small index attribute (aIdx) per vertex and computes expansion in the vertex shader.

- `src/Components/Woscope.tsx`

  - Coordinates audio elements, loads `audioData`, sets up analyser hook and passes down props to `WoscopeRenderer` including `sampleRate`, `audioElement`, `analyserPull`, and `snapshot` capture.
  - On `pause` / `seeked` it captures a frozen snapshot: preferred from decoded `audioData` (computes `startSample = floor(currentTime * sampleRate)` and calls `createVertexDataFromAudio`), else falls back to copying analyser buffers.

- `src/Components/WoscopeRenderer.tsx`

  - Maintains preallocated CPU-side typed arrays for `position` (vec3), `quadIndex` (float), `segmentT` (float), and `indices` (Uint16Array).
  - Per-frame (`useFrame`):
    - If `snapshot` is present and !isPlaying, copy snapshot vertices/indices into preallocated buffers and set drawRange.
    - Else if analyser exists, call `analyserPull()` and build vertexData from the returned analyser float arrays and render that (treated as a current window starting at sample 0).
    - Else fallback to decoded-buffer path: compute `playTime = audioElement.currentTime || currentTime` and `startSample = floor(playTime * sampleRate)` and call `createVertexDataFromAudio(left, right, startSample, config)`.
  - Uses `computeNormalizedIntensity(drawIndices)` to normalize visible brightness across different draw densities.

- `src/shaders/woscopeShaders.ts`
  - Vertex shader passes `segmentT` and `quadIndex` and sets `vIntensity = 1.0`.
  - Fragment shader computes a Gaussian falloff across the beam and multiplies by `uIntensity * vIntensity * segmentIntensity` and writes that to both RGB and alpha.

Notes from upstream: upstream's `vsLine.glsl` computes `dir = aEnd - aStart`, `uvl.z = length(dir)`, and a perpendicular `norm = vec2(-dir.y, dir.x)` to expand the quad correctly in vertex shader. The fragment shader (`fsLine.glsl`) uses an analytic integration (erf-based) to compute the accumulated Gaussian intensity across the segment length with special-cases for very short segments. Upstream's `drawLine` sets `uIntensity` uniform to 1 and handles `uInvert`, `uSize` and `uColor` there.

---

## Local data structure details (explicit)

### Audio buffers

- `audioData.leftChannel` and `audioData.rightChannel` are Float32Array of length `audioBuffer.length` (decoded samples). Sample rate is `audioData.sampleRate`.
- `useAudioAnalyser.pull()` returns: `{ left: Float32Array, right: Float32Array }` — each is a view of the analyser buffer with length `nSamples` (the user-requested window length). These buffers are reused and written into in-place each call.

### Vertex layout produced by `createVertexDataFromAudio`

- Vertex floats per vertex: 4
  1. x — X coordinate (oscilloscope X or time/sweep value depending on mode)
  2. y — Y coordinate
  3. quadIndex — float 0..3 for corner identification to expand quads
  4. segmentT — 0.0 at segment start, 1.0 at segment end (used by shader uv.x)
- Per segment (N-1 segments for N samples): 4 vertices -> 16 floats
- Indices: 6 per segment (two triangles forming a quad)

Upstream nuance: upstream represents quads as 4 distinct vertices per segment and uses a separate quad-index attribute (aIdx) with values 0..N-1; the vertex shader derives which corner of the quad it is rendering by `mod(aIdx,4.0)` and which segment by `floor(aIdx/4.0+0.5)`. That idiom is why upstream can upload `aStart` and `aEnd` per-vertex and compute accurate tangent/normal in the shader.

Memory sizing examples

- For nSamples = 1024:
  - numSegments = 1023
  - vertices = 1023 \* 4 = 4092 vertices
  - vertex float count = 4092 _ 4 = 16368 floats -> positions array for gl position becomes 4092 _ 3 = 12276 floats
  - indices = 1023 \* 6 = 6138 indices (Uint16Array)

Note on attribute packing and GPU upload

- The renderer keeps JS-side typed arrays preallocated and copies values into them each frame and assigns them to THREE.BufferAttributes with needsUpdate = true. This avoids allocating new typed arrays every frame.

---

## Timing & sample-accurate mapping

- The local code computes `startSample` in two ways:
  1. Fallback decoded-buffer path: `playTime = audioElement.currentTime || currentTime` then `startSample = Math.floor(playTime * sampleRate)`.
     - This maps seconds -> sample index exactly using the decoded buffer's sampleRate. It will track `playbackRate` automatically because `audio.currentTime` reflects playback rate.
  2. Snapshot capture on pause: exactly the same mapping is used to compute the sample-aligned frozen window.
  3. Analyser (live) path: uses the analyser time-domain buffer as the current window starting at sample 0 — this is low-latency but not directly tied to the decoded buffer's absolute sample index. It reflects live audio and playbackRate but does not provide an absolute sample index into decoded buffer.

Implications for sample-accuracy

- The decoded-buffer fallback and snapshot modes are sample-accurate if `startSample = floor(currentTime * sampleRate)` is the desired mapping (whole-sample alignment). If you need fractional sample alignment (sub-sample interpolation) you must interpolate between samples (e.g., linear or higher-order) using fractional sample offsets derived from currentTime \* sampleRate.
- The analyser path is real-time and good for live visuals but is not trivially sample-indexed into the decoded buffer (unless you correlate analyser buffer timing to audioCtx.currentTime and compute offsets).

Upstream behaviour: the upstream `woscope` uses two live approaches depending on capability: `analyser` mode (preferred when `getFloatTimeDomainData` exists) and a `scriptProcessor` fallback. In `analyser` mode they call `analyser.getFloatTimeDomainData(left)` / `...right` and then route those arrays through `channelRouter` and `loadWaveLive` to the same rendering pipeline that `loadWaveAtPosition` (decoded-window path) uses. Their `nSamples` default is 2048 and `analyser.fftSize` is set to 2048. This matches our decision to use 2048 as the baseline live window for parity.

---

## What we need to check against the original woscope

Because I have concrete excerpts from `m1el/woscope` available, the list below is an exact checklist of fields and behaviors we should align to achieve parity. I can fetch the full repo if you want a line-by-line diff and automated patch generation.

Points to compare (exact)

1. Vertex layout: does original woscope use the same interleaved vertex format (x,y,quadIndex,segmentT) or a different attribute set (for example, per-vertex normal, per-vertex time, color)?
2. Index order & winding: Is their quad -> two-triangle mapping identical to ours (0,1,2, 1,2,3) or do they use a triangle-strip pattern or degenerate triangles for continuous strips?
3. Expansion strategy: we use a simplified perpDir (vec2(0,1)) in shader; original likely computes proper perpendicular using adjacent vertices — confirm exact math and whether vertex attributes include line direction.
4. Segment uv semantics: `segmentT` meaning, whether original encodes distance or time into segmentT and whether they handle segmentLength scaling in the shader.
5. Timing mapping: original woscope's mapping of seconds -> sample index. Do they use floor(time\*sampleRate) or a sweep+interpolation approach? How do they handle playbackRate and AudioContext vs audio element timing?
6. Live vs decoded buffer: Does original prefer analyser data for live visuals, or always render from decoded buffer windows? How do they keep analyser and decoded buffer in sync (if at all)?
7. Rendering technique: quads-per-segment vs GL_LINE/line-strip + shader expansion — original may use different GPU strategy.
8. Color/alpha/blending model and intensity normalization: does original adjust intensity based on overlap, or rely on raw additivity? Do they modulate alpha separately?

Concrete upstream observations (from inspected excerpts):

- Vertex attributes used upstream: `aStart` (vec2), `aEnd` (vec2), `aIdx` (float/short) and varyings `uvl` used to pass tangent/side/segmentLength into fragment shader.
- Vertex shader computes tangent and perpendicular normal, and expands the quad by `(tang*dir + norm*side) * uSize * uInvert` producing correct beam geometry across all orientations.
- Fragment shader implements the analytic Gaussian integration and multiplies by `afterglow` computed from `uvl.w` (the segment index) to get trailing smoothing.
- The upstream draw loop: `draw()` chooses live vs buffer window, writes into `vbo`/`vbo2` via `loadChannelsInto`/`channelRouter`, calls `drawLine()` which binds attributes including `quadIndex`/`vertexIndex` and issues `gl.drawElements(..., (ctx.nSamples-1)*2*3, ...)`.

---

## Actionable next steps to reach sample-accurate parity

1. Fetch & inspect original woscope repository (I can do this for you).

   - If you'd like, I can fetch https://github.com/m1el/woscope, parse the vertex generation code, and produce an exact mapping to our `createVertexDataFromAudio` and shader attributes.

2. Decide on sample-accuracy target:

   - Exact integer-sample window (floor): current code implements this for decoded buffer and snapshot.
   - Fractional-sample accurate drawing: implement fractional sample offsets and interpolation when generating vertex positions (recommended if you want perfect timing w.r.t. audio playbackRate and smoothing).

3. Implement (if desired):

   - Fractional sample interpolation in `createVertexDataFromAudio`: allow `startSample` to be a float and interpolate sample values for the first/last sample accordingly.
   - Optionally compute per-vertex direction attributes (line direction) so shader can correctly expand quads perpendicular to line direction instead of a constant vertical expansion.
   - If original woscope computes beam width based on segment length, replicate that logic (use `vSegmentLength` as their shader expects).

Specific patch plan (summary) — what I recommend as concrete edits

- `src/utils/woscopeVertexUtils.ts`: change the vertex output to be upstream-compatible (either provide separate `aStart`/`aEnd` arrays or a packed startEnd Float32Array and a sequential `aIdx` attribute). Add `makeRamp()` helper and align `nSamples` default to 2048.
- `src/shaders/woscopeShaders.ts`: port upstream `vsLine.glsl` and `fsLine.glsl` logic (tangent/norm, `uvl` varyings, erf-based analytic fragment) adapted to three.js/ShaderMaterial attribute names (`aStart`, `aEnd`, `aIdx`) and uniform names (`uInvert`, `uSize`, `uIntensity`, `uColor`).
- `src/Components/WoscopeRenderer.tsx`: change BufferGeometry attributes to use `aStart`/`aEnd`/`aIdx`, preallocate backing arrays accordingly, and update snapshot format and copying logic. Keep intensity normalization.
- `src/hooks/useAudioAnalyser.ts`: ensure `pull()` returns arrays with length matching `woscopeConfig.nSamples` (2048) and keep zero-allocation behavior.

If you approve, I will apply these edits and run the repository type checks and a quick dev-server smoke test. I will fix any type/shader compile issues iteratively (3 attempts max) and report results.

4. Testing & validation:
   - Unit test `createVertexDataFromAudio`: given synthetic known waveforms (sine, ramp), assert vertex positions equal expected values for various startSample values (integers and fractional if implemented).
   - Visual smoke test: render both our renderer and the original woscope (or a small headless snapshot tool) with the same audio window and compare rendered outputs (visual diff or sample rasterization comparison).

---

## Example unit test ideas (jest-like)

- Test: `startSample=0` for a known stereo ramp (left=0..N, right=N..0). Expect vertex.x,y values match ramp samples scaled by amplitudeScale.
- Test: `startSample = 1.5` (if fractional): expect first vertex to be linear interpolation between sample[1] and sample[2].
- Test: indices length: for nSamples N expect indices.length === (N-1)*6 and vertices.length === (N-1)*4\*4.

---

## Deliverables I can produce next (pick one)

- A. Fetch the `m1el/woscope` repo, parse its vertex-generation + shader code and produce a precise field-by-field comparison file and a patch plan to make our implementation match exactly.
- B. Implement fractional-sample interpolation in `createVertexDataFromAudio` and add unit tests for sample-accuracy.
- C. Add a small visual test harness that renders identical windows with our renderer and a reference (if we fetch original) and produces a PNG diff.

Tell me which deliverable you want me to run next. If A, I will fetch the remote repo and produce a detailed diff/plan and then optionally apply the upstream-aligned patches automatically.
