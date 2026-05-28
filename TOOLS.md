# Tools and Libraries Used

This project is a browser-based interactive music prototype for gesture-controlled ambient game soundtrack generation. It combines webcam hand tracking, a rule-based ambient music engine, and browser audio playback.

## Core App Stack

### Vite

Vite is used as the development server and build tool. It provides fast local development, TypeScript support, and production builds for the browser app.

Commands:

```bash
npm run dev
npm run build
```

### React

React is used for the camera view, controls, preset selector, meters, transport buttons, and status readouts.

The main UI lives in:

```text
src/App.tsx
```

### TypeScript

TypeScript models gestures, ambient presets, generated musical events, and audio loading state.

Important shared types live in:

```text
src/music/types.ts
```

## Computer Vision

### MediaPipe Tasks Vision

MediaPipe is used for browser-based hand tracking through the webcam. It detects hand landmarks and returns normalized hand coordinates.

Used for:

- detecting visible hands
- drawing landmark dots over the camera feed
- estimating hand center, height, movement, speed, and gesture size
- recognizing swipe and circular motion

Main hook:

```text
src/hooks/useHandTracking.ts
```

Gesture feature extraction:

```text
src/music/gesture.ts
```

Gesture trigger detection:

```text
src/music/gestureTrigger.ts
```

## Music Generation

### Rule-Based Ambient Engine

The music generation is custom code. It favors slow harmony, sparse melody, rests, pads, bell accents, and arpeggio loops instead of dense hooks.

The engine uses:

- ambient scale and chord pools
- intentional rests
- slow chord progression changes
- gesture-influenced pitch register and direction
- stillness-driven pads and drones
- swipe-triggered bell accents
- circle-triggered arpeggio motion

Main file:

```text
src/music/melodyEngine.ts
```

### Ambient Presets

The app includes two ambient game soundtrack presets:

- Peaceful Meadow
- Forgotten Cavern

Each preset defines:

- key
- scale
- chord progression
- rhythm bias
- ambient layer labels
- mood

Preset file:

```text
src/music/presets.ts
```

## Audio Playback

### SoundFont Player

`soundfont-player` is used to load browser-playable sampled instruments for piano, bells, harp, strings, and choir-like pads.

Audio engine:

```text
src/audio/ambientSoundscape.ts
```

### Web Audio API

The Web Audio API is used directly for:

- audio context management
- gain/mixer routing
- soft oscillator pads
- filtered air texture
- long delay feedback
- fade-out behavior

## UI Icons

### Lucide React

`lucide-react` provides icons for controls and readouts, including play/stop, camera, hand, music, tempo, and movement indicators.

## Testing

### Vitest

Vitest is used for unit tests.

Test coverage includes:

- ambient grammar constraints
- intentional rests
- pad/drone, bell, chord, and arpeggio roles
- gesture feature extraction
- swipe and circle detection
- room energy analysis

Run tests with:

```bash
npm test
```

## Linting

### ESLint

ESLint is used to catch code issues and React hook mistakes.

Run linting with:

```bash
npm run lint
```

## Project Flow

```text
Webcam
  ↓
MediaPipe hand landmarks
  ↓
Gesture feature extraction
  ↓
Swipe/circle gesture detection
  ↓
Ambient music engine
  ↓
SoundFont/Web Audio soundscape
  ↓
Browser audio output
```

## Notes

- The app runs fully in the browser.
- No external MIDI routing is required.
- Instrument playback depends on SoundFont samples loading over the network.
- Webcam access requires browser camera permission.
