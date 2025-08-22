# Woscope Audiovisual Specification and Reimplementation Plan

Goal
- Recreate the functionality of the original Woscope project (https://github.com/m1el/woscope) within this repository using React, TypeScript, @react-three/fiber, and modern web audio techniques.
- Focus on reproducing audiovisual processing: audio capture/playback, analysis (FFT, envelopes), feature extraction, and synchronized 3D/2D visualizations.

Scope and Constraints
- Follow existing project patterns: single-responsibility components, hooks for audio and vertex utilities, and no global state libraries.
- Keep implementation incremental and testable; break into stages with clear acceptance criteria.

Table of Contents
- Overview
- Key Features to Recreate
- Audiovisual Processing Details
- Data Shapes and Contracts
- UX / Visual Components
- Staged Implementation Roadmap
- Integration and Testing
- Optional Advanced Enhancements


## Overview
Woscope is a web-based audiovisual visualization tool. Its core responsibilities are:
- Play or receive audio input (file playback, microphone, or stream).
- Analyze audio in real time to extract frequency-domain (FFT) and time-domain features (envelopes, RMS, peaks).
- Map audio features to visual parameters for real-time 3D rendering.
- Provide 2D waveform/spectrogram debug graphs synchronized with the 3D scene.


## Key Features to Recreate
- Audio input sources: file playback, microphone, and optional streaming sources.
- Web Audio analysis chain: AnalyserNode (FFT), ScriptProcessor/AudioWorklet for custom processing, RMS/envelope detection, band-splitting.
- Feature extraction: global RMS, bands (low/mid/high), spectral centroid, spectral flux, transient detection.
- Visualization: 3D geometry driven by audio data (vertex displacement, color, emission), plus 2D graphs.
- Data pipeline: expose audio frames as typed arrays or Float32Array snapshots consumed by React hooks and R3F components.
- Performance: optional GPU FFT, audio worker offload, throttled updates.


## Audiovisual Processing Details
- Audio Graph:
  - SourceNode (MediaElementAudioSourceNode for playback or MediaStreamSourceNode for mic)
  - Optional GainNode for master volume
  - Optional BiquadFilterNodes for band extraction (low/mid/high)
  - AnalyserNode(s) for FFT (configurable FFT size 512-32768)
  - AudioWorklet or ScriptProcessor for precise per-sample metrics and feature extraction

- FFT & Spectral Features:
  - Use `AnalyserNode.getFloatFrequencyData` or `getByteFrequencyData` depending on precision/perf.
  - Compute spectral centroid: weighted mean of bin frequencies.
  - Compute spectral flux: difference between consecutive frames.
  - Compute band energies by summing FFT bins across frequency ranges.

- Time-domain Features:
  - RMS and envelope extraction via RMS(t) = sqrt(mean(x^2)) over a sliding window.
  - Simple peak/transient detection using short-time energy or spectral flux thresholds.

- Band Splitting Strategies:
  - Use BiquadFilter nodes (lowpass, bandpass, highpass) to create band-specific analysers.
  - Or compute from FFT bins by summing ranges for low/mid/high.

- Data Frames & Rate:
  - Capture frames at the audio context's update rate (derived from `onaudioprocess` chunk size or AudioWorklet buffer).
  - Provide an up-to-date float array snapshot for consumers (e.g., Float32Array for waveform, Float32Array for FFT magnitudes).
  - Throttle UI updates to a sensible rate (e.g., 30-60Hz) to reduce render pressure.


## Data Shapes and Contracts
- AudioFrame:
  - timestamp: number (ms)
  - waveform: Float32Array (length = bufferSize)
  - spectrum: Float32Array (length = fftSize/2)
  - rms: number
  - bands: { low: number, mid: number, high: number }
  - centroid?: number
  - flux?: number

- Hook contract: `useAudioAnalysis(source, opts) => { playing, play, pause, volume, frame }`
  - `frame` updates on available frames (throttled) and follows the AudioFrame shape.


## UX / Visual Components
- `AudioControls` (UI): playback controls, volume, file input, mic toggle, visual presets.
- `Woscope` (3D renderer): R3F scene that consumes `frame` data and maps features to geometry, color, and particle systems.
- `GraphView` (2D): waveforms, spectrogram, band energy graphs for debugging and calibration.
- `VertexCollector` / `VertexTraversal`: utilities to extract vertices from geometries and interpolate across time.

Design patterns:
- Expose audio data via hooks and pass into visual components via props.
- Keep rendering deterministic: use `useFrame` for R3F updates and consume latest frame in a stable ref.


## Staged Implementation Roadmap (Detailed)
Stage 0 — Discovery & Spec (this doc)
- Create this markdown file and confirm scope.

Stage 1 — Minimal Audio + Visual Loop (MVP)
- Implement `useAudio` hook that plays audio files and provides an `AudioContext` and `MediaElementSource`.
- Add an `AnalyserNode` to extract waveform and spectrum (FFT size 2048 default).
- Expose a basic `useAudioAnalysis` hook returning `frame` with waveform, spectrum, and RMS.
- Wire `Woscope` to consume RMS to modulate geometry scale and color.
- Add `GraphView` with simple waveform + spectrum debug graphs.

Acceptance for Stage 1:
- Play local/remote audio, see geometry respond to RMS and spectrum.
- GraphView updates in sync with audio.

Stage 2 — Band Analysis & Features
- Add band-splitting (low/mid/high) via FFT bin ranges and/or filters.
- Implement spectral centroid and flux.
- Expose band values and events (e.g., beat detection) from `useAudioAnalysis`.

Stage 3 — Vertex-level Visuals & Traversal
- Implement `VertexScreenCollector` utilities (already present in repo pattern) to capture vertices in screen space.
- Use vertex interpolation/traversal to create animated traversal visuals that react to band envelopes.

Stage 4 — Performance & GPU Offload
- Add AudioWorklet for feature extraction and pre-processing.
- Consider WebGL-based FFT or ping-pong textures for GPU-driven spectrum effects.

Stage 5 — Recording, Export, and Presets
- Add export (GIF/WebM) and presets for visuals mapping.
- Add parameter automation and state save/load.


## Integration and Testing
- Unit test hooks where feasible (e.g., utility functions for spectral centroid computation).
- Visual smoke tests: ensure `useAudio` provides consistent frames and `Woscope` renders without errors in CI headless.
- Manual verification steps: audio-playback, mic capture, graph alignment, CPU profiling.


## Optional Advanced Enhancements
- Spatial audio: integrate PannerNode and multi-channel visuals.
- ML-based feature detectors (onset detection, instrument separation).
- Headless rendering for server-side generation of visuals from audio.


## Implementation Notes & File Suggestions for This Repo
- `src/hooks/useAudio.ts` — basic audio context + playback controls + analyser setup.
- `src/hooks/useAudioAnalysis.ts` — wraps `useAudio` and extracts FFT/waveform/rms/bands.
- `src/Components/Woscope.tsx` — update to accept `frame` prop or read via context/hook.
- `src/Components/GraphView.tsx` — small waveform/spectrum renderer (Canvas2D or SVG).
- `src/utils/audioMath.ts` — spectral centroid, band sums, RMS helpers.


## Acceptance Criteria for Initial PRs
- Clear, typed API for audio hooks.
- Demo page (e.g., `App.tsx`) showing play/pause, graph, and 3D response.
- Tests for audio math utilities and at least smoke test that hook mounts without errors.


---

Appendix: Helpful references
- Web Audio API docs: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- AudioWorklet guide: https://developer.chrome.com/docs/web-platform/audioworklet/
- FFT bin math and spectral centroid references


## Summary of the "How to draw oscilloscope lines with math and WebGL" blog

Key ideas from m1el's how-to post (https://m1el.github.io/woscope-how/):
- Problem formulation: treat pairs of stereo samples as XY points and draw an XY-mode oscilloscope line by rendering many short line segments.
- Geometry strategy: represent each line segment as a rectangle (two triangles) and store start/end points plus a small index per-vertex. Each segment's quad contains four vertices that share the same aStart/aEnd attributes and differ by aIdx to produce the correct corner offsets.
- Vertex shader: uses attributes `aStart`, `aEnd`, and `aIdx` to compute per-vertex positions. It derives a tangent (direction), a normal (perpendicular), and shifts even/odd vertices left/right to build the quad. Additional varyings (uvl) are used to pass length, local coordinate and index to the fragment shader.
- Intensity / beam model: model the electron beam as a Gaussian spot. The fragment shader computes the beam intensity at each fragment by integrating the Gaussian as the beam moves from start to end; this produces smooth, realistic oscilloscope glow rather than hard lines.
- Blending: accumulate beam contributions with additive blending using `blendFunc(gl.SRC_ALPHA, gl.ONE)` so overlapping segments brighten appropriately.
- Performance considerations: quad-overdraw is an expected cost; the blog notes tradeoffs (no corner cases for joints vs triangle overdraw). Packing vertices (4 copies per segment) simplifies shader logic at the expense of extra geometry.

Practical takeaways for our reimplementation
- Data generation: generate the XY point list from stereo PCM by pairing left/right samples. Convert sample indices to normalized device coordinates or to a scene coordinate system matching the R3F camera.
- Buffer layout: implement an interleaved buffer with per-vertex attributes: `aStart(vec2)`, `aEnd(vec2)`, `aIdx(float)` (0..3), and an instance/segment index if needed.
- Shaders: port the blog's GLSL logic into our R3F materials (shader material or raw WebGLMaterial). Keep the same math for tangents/normals and the `uvl` varyings for fragment computations.
- Beam intensity: implement the Gaussian intensity in the fragment shader and perform the time-integration approximation (blog shows analytic transforms to avoid expensive per-pixel loop). Expose a `uSize` (beam spread) uniform and a `uInvert` transform to handle coordinate flipping.
- Blending and render state: enable additive blending (`THREE.AdditiveBlending`) and ensure depthWrite/depthTest are configured so glow accumulates correctly.
- Audio mapping: derive per-segment brightness and color from audio features (RMS, band energies, spectral centroid). For example, map low-band energy to thickness/size and high-band energy to color/intensity.
- Memory / draw call strategy: group segments into large buffers and redraw as streaming audio updates; consider using BufferGeometry and updating attribute arrays rather than re-creating geometries each frame.

Notes / gotchas
- The blog's approach stores each point 4 times (per quad); while wasteful, it simplifies per-vertex calculations and avoids complicated indexing for webGL glsl. We should start with the same approach and optimize later.
- Numerical stability: the shader uses an EPS guard for very short segments; preserve that logic to avoid division by zero.
- Audio -> XY scaling: ensure audio amplitude is scaled to visible ranges for your orthographic camera and scene zoom. Provide UI controls for gain/zoom to help tuning.

Mapping to roadmap stages
- Stage 1: implement audio-to-XY conversion and a simple geometry renderer that draws raw wired lines (thin lines or simple quads) to verify coordinate mapping.
- Stage 2: port the full quad-based vertex + fragment shader pipeline from the blog, add additive blending, and map audio features to `uSize` and color.
- Stage 4: once working, explore GPU-side optimizations (instancing, dynamic buffers, and possible use of transform feedback or compute-style approaches) to reduce CPU overhead from buffer updates.

Reference snippets to port
- Vertex shader pattern: compute `dir`, `norm`, `idx=mod(aIdx,4.)`, select `aStart` vs `aEnd` for current corner, compute `uvl` varyings, and set `gl_Position` using `uSize` and `uInvert`.
- Fragment shader pattern: interpret `uvl` to compute distance to the instantaneous beam path and evaluate the Gaussian cumulative intensity. Use the `uvl.w` (segment index) to look up per-segment intensity if needed.




