# r3f-traversal-testbed

A React Three Fiber application for visualizing and analyzing 3D vertex data traversal with real-time audio synthesis.

## Features

### 3D Visualization

- Interactive 3D scene with geometric objects (Triangle, Square, Polygon)
- Real-time vertex traversal and interpolation
- Color-coded vertex visualization
- Orbit controls for 3D navigation

### Data Analysis

- Real-time waveform graphs for 6 data channels:
  - Screen X/Y/Z coordinates (NDC space)
  - RGB color values
- Interactive graph tooltips with vertex information
- Visual distinction between object vertices and interpolated points

### 🆕 Audio Synthesis

- **Real-time audio generation** from vertex data using Web Audio API
- **Multi-channel output**: Each data stream (screenX, screenY, screenZ, r, g, b) becomes an audio channel
- **AnalyserNode integration**: Real-time frequency and time-domain analysis
- **Interactive controls**: Individual channel gains, global volume, audio enable/disable
- **Visual feedback**: Real-time frequency analysis visualization

## Audio Synthesis System

The application includes a comprehensive audio synthesis system that transforms 3D vertex data into multi-channel audio:

### Key Features

- **AudioWorklet-based processing** for low-latency real-time synthesis
- **6-channel audio output** (one per data stream)
- **Real-time AnalyserNode data** for frequency/time domain analysis
- **Direct waveform synthesis** - vertex data becomes audio samples
- **Interactive controls** with per-channel gain adjustment

### Technical Implementation

- Uses Web Audio API's AudioWorklet for main-thread-free processing
- Custom audio processor converts vertex arrays to audio samples
- Each data channel (screenX, screenY, screenZ, r, g, b) mapped to separate audio channel
- AnalyserNode per channel provides real-time frequency analysis
- Sample rate: 44.1kHz, Buffer size: 1024 samples, 32-bit float precision

See [AUDIO_SYNTHESIS.md](./AUDIO_SYNTHESIS.md) for detailed documentation.

## Technology Stack

- **React 18** with TypeScript for UI components
- **React Three Fiber** for 3D rendering and scene management
- **drei** for Three.js helpers (cameras, controls, primitives)
- **Web Audio API** for real-time audio synthesis and analysis
- **Vite** for development and building
- **Three.js** for 3D mathematics and rendering

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd r3f-traversal-testbed

# Install dependencies
pnpm install

# Start development server
pnpm run dev
```

### Development

```bash
pnpm run dev    # Start dev server (localhost:5173)
pnpm run build  # Build for production
pnpm run lint   # Run ESLint
```

## Project Structure

```
src/
├── Components/
│   ├── audioUtils.ts           # Audio synthesis utilities
│   ├── useVertexAudio.ts       # React hook for audio management
│   ├── AudioControls.tsx       # Audio controls UI component
│   ├── vertexUtils.ts          # 3D vertex processing utilities
│   ├── vertexScreenUtils.ts    # Screen projection utilities
│   ├── GraphView.tsx           # 2D waveform visualization
│   ├── WaveformGraph.tsx       # Individual waveform component
│   ├── SceneView.tsx           # 3D scene container
│   ├── VertexScreenXCollector.tsx # Data collection component
│   ├── [Shape]Points.ts        # Geometry definitions
│   └── [Shape].tsx             # 3D shape components
├── App.tsx                     # Main application component
└── main.tsx                    # Application entry point

public/
└── vertexAudioProcessor.js     # AudioWorklet processor
```

## Usage

### Basic Visualization

1. Open the application in a modern browser
2. Use mouse/trackpad to orbit around the 3D scene
3. Observe real-time waveform graphs showing vertex data
4. Hover over graph points for detailed vertex information

### Audio Synthesis

1. Click the "🔇 Audio OFF" button to enable audio synthesis
2. Adjust global gain and per-channel gains using sliders
3. Enable "Show Analysis" to see real-time frequency analysis
4. Each data stream (X, Y, Z, R, G, B) produces audio on separate channels

### Data Analysis

- **Green line**: Screen X coordinates (horizontal movement)
- **Orange line**: Screen Y coordinates (vertical movement)
- **Purple line**: Screen Z coordinates (depth, alternates 0/1 for object/interpolated)
- **Red line**: Red color channel values
- **Green line**: Green color channel values
- **Blue line**: Blue color channel values

## Architecture

### Data Flow

```
3D Objects → Vertex Traversal → Screen Projection → Waveform Graphs
     ↓              ↓                ↓                    ↓
Geometry Data → World Coords → NDC Coordinates → Visual Analysis
     ↓              ↓                ↓                    ↓
Audio Samples → AudioWorklet → Multi-channel Audio → Frequency Analysis
```

### Key Concepts

- **Vertex Traversal**: Sequential processing of object vertices with interpolation
- **Screen Projection**: Converting 3D coordinates to normalized device coordinates
- **Audio Synthesis**: Real-time conversion of vertex data to audio samples
- **Multi-channel Analysis**: Parallel processing of different data streams

## Browser Compatibility

- **Modern browsers** with WebGL and Web Audio API support
- **AudioWorklet** requires Chrome 66+, Firefox 76+, Safari 14.1+
- **Fallback** available for browsers without AudioWorklet support

## Performance

- **Real-time processing** at 60fps for graphics
- **Low-latency audio** (~23ms) via AudioWorklet
- **Efficient data structures** using Float32Array and Uint8Array
- **Memory footprint**: ~40KB for audio buffers + WebGL resources

## Contributing

1. Follow the existing code style and patterns
2. Use TypeScript strict mode
3. Maintain single responsibility principle
4. Add JSDoc comments for complex functions
5. Test audio features across different browsers

## License

This project is licensed under the MIT License.

## Development Setup

### ESLint Configuration

For production applications, consider enabling type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]);
```

### React-specific Lint Rules

Install additional React lint plugins:

```bash
pnpm add -D eslint-plugin-react-x eslint-plugin-react-dom
```

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default tseslint.config([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      reactX.configs["recommended-typescript"],
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
]);
```
