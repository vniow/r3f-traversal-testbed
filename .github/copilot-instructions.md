# Copilot Instructions for r3f-traversal-testbed

## Project Overview

- **Type:** Minimal React + TypeScript + Vite app for 3D geometry and data visualization.
- **Core libraries:** `@react-three/fiber`, `@react-three/drei`, `three`, Vite.
- **Goal:** Visualize and analyze traversal/interpolation of 3D vertex data, with synchronized 2D graph views.

## Architecture & Data Flow

- **Entry point:** `src/App.tsx` wires together the 3D scene (`SceneView`) and 2D graph (`GraphView`).
- **3D Scene:**
  - `SceneView` renders objects (Triangle, Square, Polygon) and interpolated points using React Three Fiber.
  - Vertex data is collected each frame via `VertexScreenXCollector` and passed up to `App`.
  - `useLogVertices` and `useVertexTraversal` in `vertexUtils.ts` handle traversal and logging of vertex data.
- **2D Graphs:**
  - `GraphView` and `WaveformGraph` visualize vertex data (screenX, screenY, screenZ, r, g, b) as waveforms.
  - `Debug.tsx` overlays multiple `WaveformGraph` components for different data channels.
- **Data pipeline:**
  - 3D objects → vertex data extraction (screen/projected) → passed to 2D graph components for visualization.

## Design Principles & Coding Guidelines

- **Single Responsibility Principle:** Each file/component should have one clear purpose (e.g., shape, utility, graph, collector).
- **Composition over Inheritance:** Favor composing small components and hooks for flexibility and reuse.
- **Props-down, Events-up:** Data flows down via props, events/callbacks bubble up (e.g., `setVertexData`).
- **Immutability:** All state and vertex updates must be immutable.
- **No global state:** All state is local or passed via props; do not introduce global/external state libraries.
- **Explicit Data Shape:** Vertex data is always arrays of numbers, with color channels (r, g, b) and screen/projected coordinates (screenX, screenY, screenZ).
- **Interpolation Convention:** Interpolated points are generated between objects and tracked with a `source` array (`object` or `interpolated`).
- **Component Structure:**
  - All 3D logic is in `src/Components/`, with one file per shape/component.
  - Utility logic for vertex math and data collection is in `vertexUtils.ts` and `vertexScreenUtils.ts`.
- **Aliasing:** Use `@src` alias for imports from `src/` (see `vite.config.js`).
- **KISS & YAGNI:** Keep implementations simple and avoid unnecessary features or abstractions.
- **DRY:** Abstract repeated logic into utilities or hooks.
- **Explicit Typing:** Use TypeScript strict mode and explicit types for all props and data structures.
- **Functional Components:** Use function declarations for components; extract logic into custom hooks when needed.
- **Separation of Concerns:** Keep rendering, data processing, and utility logic in separate files/modules.
- **Consistent Naming:** Use clear, descriptive names for files, components, and variables.
- **Minimal Styling:** Prefer simple CSS or inline styles; avoid introducing CSS frameworks unless justified by project needs.
- **Accessibility:** Ensure basic keyboard navigation and color contrast in 2D graph views.

## Developer Workflows

- **Start dev server:** `pnpm run dev` (Vite, port 5173 by default)
- **Debugging:** Attach to Chrome with VS Code launch config (see `.vscode/launch.json`).
- **Linting:** ESLint config in `eslint.config.js`. For type-aware linting, see README for plugin setup.
- **No formal test suite** (as of this writing).

## External Integrations

- **Three.js** for 3D math and rendering.
- **@react-three/fiber** for React-based 3D scene management.
- **@react-three/drei** for helpers (cameras, controls, etc).

## Examples

- See `src/Components/vertexUtils.ts` for traversal and interpolation logic.
- See `src/Components/Debug.tsx` for how all vertex data channels are visualized in parallel.
- See `src/App.tsx` for the main data flow and component wiring.

---

**When adding new features:**

- Follow the pattern of extracting vertex data in 3D, then visualizing in 2D.
- Keep all 3D logic in `src/Components/` and utility logic in `vertexUtils.ts` or `vertexScreenUtils.ts`.
- Maintain the `source` array convention for distinguishing original vs. interpolated points.
- Use clear, minimal, and composable components/hooks. Avoid unnecessary complexity or global state.
