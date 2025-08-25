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
  1.  Static / preloaded audio: uses XHR to fetch an audio file into an ArrayBuffer, decodes it via `audioCtx.decodeAudioData` and then `prepareAudioData(ctx, buffer)` extracts left/right Float32Array channel buffers used for offline stepping during playback.
  2.  Live audio: uses `createMediaElementSource(audio)` and either an `AnalyserNode` or a `ScriptProcessorNode` depending on browser capabilities (`getFloatTimeDomainData` availability). The analyser mode uses `analyser.getFloatTimeDomainData()` to read time-domain samples. The scriptProcessor mode uses `onaudioprocess` to append samples into circular buffers.
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

## Shader implementation details (deep dive)

This section documents the core shader math used by `vsLine.glsl` and `fsLine.glsl` in the upstream project and explains how attributes, uniforms and the varying `uvl` are used to compute the final glowing beam effect. The goal is to provide a precise reference you can use when porting or validating a three.js/ShaderMaterial implementation.

### Vertex shader (vsLine.glsl)

- Purpose: expand each line segment (start->end) into a quad and compute per-vertex outputs used by the fragment shader to calculate an analytically integrated Gaussian beam.

- Input attributes expected by the upstream shader:

  - `aStart` (vec2): segment start in visual space
  - `aEnd` (vec2): segment end in visual space
  - `aIdx` (float): integer-like value encoding segment index and quad corner: aIdx = segmentIndex \* 4 + corner (corner in 0..3)

- Uniforms typically used:

  - `uInvert` (float): optionally invert X/Y sign (1 or -1)
  - `uSize` (float): half-width of the beam in visual units (controls thickness)
  - (projection/modelView handled by GL)

- Key computed values (commonly packed into a varying vec4 `uvl`):

  - uvl.xy: encoding of tangent sign and side sign which identifies which corner of the expanded quad this vertex represents. The shader uses `mod(aIdx, 4.0)` to find the corner (0..3). From that it derives two values:
    - tangent direction: ±1 indicating start vs end vertex used for interpolation along the segment
    - side: ±1 indicating top/bottom side of the quad
  - uvl.z: segment length = length(aEnd - aStart). This is used in the fragment shader when computing analytical integration and as a guard for very short segments.
  - uvl.w: segment number (floor(aIdx / 4.0 + 0.5)) used to compute afterglow/fade based on segment age

- Geometry expansion logic:

  1.  Compute direction vector `dir = aEnd - aStart` and its length `L = length(dir)`.
  2.  Normalize `dir` to `dir /= L` unless `L < EPS` (degenerate), in which case a default direction (e.g., vec2(1.0, 0.0)) is used.
  3.  Compute perpendicular normal `norm = vec2(-dir.y, dir.x)`.
  4.  For each vertex determine `current` point = either `aStart` or `aEnd` depending on corner (tangent sign). Compute expansion offset = tang _ dir _ uSize + norm _ side _ uSize. The final vertex position = (current + offset) \* uInvert.

- Notes:
  - By computing expansion in the vertex shader with the real segment direction `dir` the beam is expanded along the true orthogonal, avoiding visual artifacts at steep angles or when time-domain data results in highly slanted segments.
  - The encoded `aIdx` both chooses which endpoint to use and carries the segment index used for temporal fades.

### Fragment shader (fsLine.glsl)

- Purpose: compute a physically-plausible glowing beam profile for each quad fragment by analytically integrating a Gaussian cross-section over the fragment coordinates; this results in a smooth, anti-aliased, energy-consistent line regardless of beam width or segment length.

- Inputs and uniforms:

  - varying `uvl` (vec4) coming from vertex shader: (tangentSign, sideSign, length L, segmentIndex)
  - `uSize` (float) — beam half-width in visual units
  - `uIntensity` (float) — global multiplier controlling total beam brightness
  - `uColor` (vec4) — base color (RGBA) modulated by computed alpha
  - `uN` (float) — normalization or 'afterglow length' used to scale per-segment fade

- Constants used by upstream code:

  - EPS for short-segment guard
  - TAU, TAUR (1/sqrt(2π)), SQRT2 used in gaussian and erf approximations

- Core math (summary):

  1.  The shader maps fragment-local coordinates into a canonical 2D coordinate system `xy` where `x` corresponds to along-segment position (with an origin shifted so the analytic integrals are simple) and `y` is perpendicular offset from the centerline.
  2.  Use sigma = uSize / 4.0 (this choice shapes the Gaussian width relative to beam thickness).
  3.  If segment length `L` is effectively zero (short segment), compute a simple 2D Gaussian sample (a fallback) to avoid division by zero / inaccurate integrals.
  4.  Otherwise compute the analytic integrated intensity along the x-dimension using the error function `erf` to capture the integral of the Gaussian over a finite interval. The formula used is:

      - alpha = (erf((L - x)/ (SQRT2 _ sigma)) + erf(x / (SQRT2 _ sigma))) * exp(-y*y/(2*sigma*sigma)) _ (1 / 2 / L) _ uSize

      This comes from integrating a Gaussian centered on the beam axis across a finite segment of length `L` and normalizing appropriately.

  5.  Multiply by an `afterglow` factor derived from `uvl.w` (segment index) scaled by `uN` so newer or earlier segments fade in/out as desired:

      - afterglow = smoothstep(0.0, 0.33, uvl.w / max(1.0, uN))

  6.  Multiply alpha by `afterglow * uIntensity` and apply as the final fragment alpha channel; color is `uColor` multiplied by alpha.

- Why use erf/analytic integration?
  - Performing the Gaussian integral with `erf` yields a smooth, anti-aliased, energy-aware line independent of the pixel grid and beam width. Sampling a Gaussian naively per-pixel with texture-space sampling would either require oversampling or cause brightness variance depending on fragment coverage; analytic integration sidesteps that.

### Attribute encoding and index buffers

- Vertex packing pattern used upstream (common approach):
  - Each segment produces 4 vertices (a quad). Upstream stores per-vertex attributes so the vertex shader can pick whether it is operating on the start or end endpoint and which side of the quad it represents.
  - `aIdx` encodes both quad corner and the segment number: aIdx = segmentIndex\*4 + cornerIndex (cornerIndex = 0..3). The vertex shader uses `mod(aIdx, 4.0)` to select corner logic and `floor(aIdx / 4.0 + 0.5)` to recover segmentIndex for temporal effects.
  - The element/index buffer uses 6 indices per segment (two triangles per quad) in the pattern [0,1,2, 1,2,3] for each quad's 4 vertices.

### Precision, guards and numerical choices

- EPS guard: the vertex/fragment pair check for `len < EPS` to handle degenerate segments (duplicate points). Short segments are rendered with a safe Gaussian fallback to avoid division by zero and visual glitches.
- Constants such as TAU, TAUR are used to compute a correctly normalized Gaussian. `sigma = uSize / 4.0` is upstream's pragmatic choice that balances visible thickness against Gaussian falloff.

### Uniforms — types and typical ranges

- `uSize` (float): 0.002 — 0.05 typical depending on view scale. It is the half-width used to expand the quad in vertex shader and the sigma scaling in fragment shader.
- `uIntensity` (float): 0.1 — 2.0 typical. Multiplies final brightness.
- `uColor` (vec4): RGB color with alpha multiplier; fragment alpha is modulated by computed beam alpha.
- `uInvert` (float): usually 1.0 or -1.0 depending on coordinate mapping needs.
- `uN` (float): a normalization denominator used to compute the afterglow fade; upstream defaults to the number of samples (`nSamples`) so `uvl.w / uN` yields segment-relative age in [0,1].

### Integration notes for porting to three.js / r3f

- Attribute layout: supply `aStart` and `aEnd` as vec2 BufferAttributes (or as InterleavedBuffer with offsets) and `aIdx` as a float attribute. We updated our renderer to emit the interleaved layout `[aStart.x,aStart.y,aEnd.x,aEnd.y,aIdx]` (5 floats per vertex) and to upload it via `THREE.InterleavedBuffer`.
- Set `uN` to the `nSamples` value (e.g., 2048) so afterglow scaling matches upstream.
- Ensure `aIdx` uses exact integer-like floats. The vertex shader relies on `mod` and `floor` on this attribute; small FP rounding shouldn't matter if you pack as `segment*4 + corner` and store as `float`.
- For the last vertex / segment, duplicate endpoint coordinates to avoid degenerate `dir` values; the vertex shader will then use EPS logic to fallback to a safe direction.

### Other shaders (blur / output)

- The blur shaders implement a separable Gaussian-like blur that is applied to a lower-resolution texture to create bloom/glow. They are not mathematically coupled with vsLine/fsLine beyond consuming/producing RGBA textures.
- The output shader composites the original line texture and blurred bloom texture, usually with additive blending and a small gamma/alpha tweak.

## Recommendations & checklist for integration

- Emit upstream-compatible interleaved vertex buffer: `[aStart.x,aStart.y,aEnd.x,aEnd.y,aIdx]` and upload via `THREE.InterleavedBuffer` using stride=5; create `InterleavedBufferAttribute`s at offsets 0 (aStart), 2 (aEnd) and 4 (aIdx).
- Keep `uN` in sync with `nSamples` (set uniform each frame or when `nSamples` changes).
- Use `EPS` guards and duplicate endpoints for the last vertex to avoid `dir` division-by-zero.
- Prefer analyser-mode with `analyser.fftSize = nSamples` (2048 in upstream) so the per-frame sample size and shader normalization match assumptions.
- When capturing offline snapshots for paused frames, store them in the new interleaved format so they can be replayed without conversion.

## Blur & output shader analysis

This section focuses specifically on the blur (bloom) pass shaders and the final output/composite shader used by upstream `woscope`. It explains the typical separable blur architecture used in the project and calls out the important uniforms, sampling strategy and precision choices you should replicate in a three.js port.

### Blur pass (separable blur)

- Purpose: create a soft glowing halo around bright beam fragments by blurring a rendered line texture and compositing it additively over the base rendering.

- Typical architecture used upstream:

  1. Render the thick, glowing beam into an offscreen texture (lineTexture).
  2. Optionally generate mipmaps or downsample to lower-resolution render targets to reduce cost (common to render into several progressively smaller buffers).
  3. Run separable blur passes: a horizontal blur (or 'transpose' variant depending on naming) followed by a vertical blur. Separable blurs lower complexity from O(k^2) to O(k+k).
  4. Accumulate the blurred results (possibly across mip levels) into a bloom buffer.
  5. Composite the bloom buffer additively on top of the base texture in the final output shader.

- Shader math and sampling notes:

  - The blur shader usually receives these uniforms:
    - `uTexture` (sampler2D): the input texture to blur.
    - `uStep` / `uTexel` (vec2): one over the texture size, used to compute offset sample coordinates.
    - `uDirection` (vec2): normalized direction of blur (e.g., (1,0) for horizontal, (0,1) for vertical) or separate horizontal/vertical shaders.
    - `uKernel[weights]` and `uOffsets` (either implicit or precomputed): weights and offsets for symmetric Gaussian taps.
  - To save performance, upstream often uses a small kernel (e.g., radius 6–10) and leverages bilinear filtering by sampling at half-pixel offsets to effectively double the kernel width per sample.
  - `fsBlurTranspose.glsl` naming in upstream suggests an optimization where the vertex shader supplies transposed coordinates or where horizontal/vertical passes are implemented as the same shader with a direction uniform.

- Precision & render target choices:
  - Use linear filtering for min/mag on intermediate render targets to get smooth interpolation between taps.
  - Use a half-float or unsigned byte format depending on the desired dynamic range and platform support. For bright bloom, `THREE.HalfFloatType` or `THREE.UnsignedByteType` with `LinearFilter` is a pragmatic choice.
  - Disable depth/stencil for blur render targets; these passes operate on full-screen quads.

### Output / composite shader

- Purpose: combine the base line rendering and the blurred bloom texture into the final image. The shader typically applies additive blending for the bloom and optionally tone-mapping or gamma correction.

- Typical uniforms:

  - `uBase` (sampler2D): the original line texture
  - `uBloom` (sampler2D): the blurred bloom texture (or a chain of mip levels)
  - `uBloomIntensity` (float): multiplier for bloom strength
  - `uGamma` / `uExposure` (optional): adjustments for final color mapping

- Compositing steps:

  1. Sample base and bloom textures at fragment UVs.
  2. Apply additive compose: color = base + bloom \* uBloomIntensity.
  3. Optionally perform tonemapping or gamma correction; clamp or otherwise limit values to avoid color overflow depending on render pipeline.

- Edge cases & robustness:
  - When the line texture is rendered with premultiplied alpha or additive blending, ensure the blur pass sees alpha in the expected encoding. Upstream tends to treat the line texture as straight alpha with additive composition applied later.
  - On HiDPI screens, match render-target sizes to the canvas pixel size (devicePixelRatio) or choose a fixed scale factor for the bloom buffer (e.g., half resolution) to keep the effect consistent.

## Implementation plan — r3f / three.js compatible

Goal: implement a faithful, performant bloom pipeline in React Three Fiber that mirrors upstream behavior while fitting the project's architecture (reusable components, explicit Buffer/ShaderMaterial control, and minimal per-frame allocations).

High-level tasks (actionable):

1. Create small pass components

   - `LinePass` (already present): renders the line geometry into an offscreen `lineRenderTarget` using the ported `woscope` line shaders.
   - `BlurPass` (new): performs separable blur. API:
     - props: `inputRenderTarget`, `outRenderTarget`, `radius`, `direction` ('h'|'v'), `iterations`.
     - Implementation: render a full-screen quad with a blur shader; use `uStep` = vec2(1/width, 1/height) and `uDirection` to drive horizontal/vertical sampling.
   - `BloomPass` (new): orchestrates downsample, blur(s), and accumulation. API:
     - props: `source`, `strength`, `downsampleLevels`.
     - Implementation: allocate a chain of render targets (half, quarter, etc.), blur each level, composite additively into a bloom target.
   - `OutputPass` (new): composites `lineRenderTarget` + `bloomRenderTarget` onto the default framebuffer using a small ShaderMaterial that multiplies by `uBloomIntensity` and optionally performs gamma correction.

2. Render-target management

   - Use `THREE.WebGLRenderTarget` (or drei's `useFBO`) with `LinearFilter` and `THREE.UnsignedByteType` by default; prefer `HalfFloatType` when available (and convert properly).
   - Ensure `renderTarget.texture.encoding` matches the main renderer (sRGB) or that the final output shader handles gamma.
   - Set `depthBuffer: false` and `stencilBuffer: false` on intermediate targets.

3. Shader porting notes

   - Port `fsBlurTranspose.glsl` and its horizontal sibling carefully:
     - Replace WebGL1 varying conventions if necessary (three.js expects `varying` in both vs and fs; keep as-is when using ShaderMaterial strings).
     - Replace direct texture lookup helpers with `texture2D` or `texture` depending on GLSL version; three.js ShaderMaterial uses `texture2D` in WebGL1 context.
     - Provide `uTexel`/`uStep` uniform (vec2) and compute sample offsets as `uv + uDirection * offset * uStep`.
   - Port `fsOutput.glsl`: expose `uBase`, `uBloom`, `uBloomIntensity`, and optionally `uGamma`.

4. Integrate into React lifecycle

   - Create a small internal scene and orthographic camera with a full-screen quad for passes.
   - Use react-three-fiber's `useFrame` to run the `LinePass` then the `BloomPass` and `OutputPass` each frame in order. Use `renderer.setRenderTarget` to swap targets and `renderer.render(scene, camera)` for the pass.
   - For convenience, encapsulate pass orchestration in a `WoscopeComposer` component that takes the line-mesh as input and exposes `bloomIntensity` and `enabled` props.

5. Performance & quality knobs

   - Expose `downsampleLevels` (1..4), `blurRadius` (small integers), `bloomStrength` and `useHalfFloat` to tune quality vs. performance.
   - Use `renderer.capabilities.isWebGL2` or `renderer.extensions.get('EXT_color_buffer_half_float')` to decide whether to use `HalfFloatType`.
   - Use `renderer.setScissorTest` sparingly and avoid extra draws; prefer downsampled targets to reduce work.

6. Testing & verification

   - Smoke test in browser: ensure blur pass textures are non-empty and composite visually appears.
   - Check for GL shader compile errors in the console and fix any precision/extension issues.
   - Compare output to upstream demo visually (same audio file and parameters), tweak `uSize`, `uIntensity`, `bloomStrength` to match.

7. Optional improvements
   - Migrate to a multi-pass composer or use `postprocessing` library if you want to reuse existing passes (but maintain code control if you want fidelity to upstream).
   - Implement temporal anti-flicker or multi-sample blur accumulation for higher-quality bloom at low sample counts.

Files/components to add (suggested)

- `src/Components/BloomPass.tsx` — small r3f component implementing one separable blur pass.
- `src/Components/BloomComposer.tsx` — orchestrates downsample chain and composite.
- `src/Components/OutputPass.tsx` — final composite shader material and full-screen quad.
- `src/shaders/blurShaders.ts` — ported `vsBlurTranspose.glsl` and `fsBlurTranspose.glsl` (horizontal/vertical variants) adapted for three.js ShaderMaterial uniforms.

Runbook (how to iterate quickly)

1. Implement `BloomPass` with a single horizontal/vertical pass and verify it blurs a test texture (start with a checkerboard or bright quad to debug).
2. Integrate `BloomComposer` to downsample the line texture and run multiple passes; visually tune kernel weights.
3. Add `OutputPass` that composites the bloom and line textures and verify composite looks correct.
4. Integrate into `WoscopeRenderer` so the renderer writes lines into `lineRenderTarget` and the composer consumes it.

This plan aims to match upstream behavior while making the implementation idiomatic to r3f and three.js, keeping high performance and configurability.
