# SwiftChess

SwiftChess is a lightweight React chessboard component with fast drag interactions, premoves, and drawable arrows.

## Install

```bash
npm install swiftchess chess.js
```

Import the package and styles:

```tsx
import { ChessBoard } from 'swiftchess'
import 'swiftchess/style.css'
```

## Development

```bash
npm install
npm run dev
```

Build the npm package:

```bash
npm run build
```

Build the demo app:

```bash
npm run build:demo
```

## Local npm-test route

Run:

```bash
npm run dev
```

Then open:

```text
http://localhost:5173/npm-test
```

## External chess.js API (new)

`ChessBoard` now consumes your own `Chess` instance and `position` string instead of owning internal game state.

```tsx
import { Chess } from 'chess.js'
import { ChessBoard } from 'swiftchess'
import 'swiftchess/style.css'

const chess = new Chess()

<ChessBoard
  chess={chess}
  position={chess.fen()}
  onPositionChange={(fen) => setPosition(fen)}
  playerColor="w"
/>
```

## ChessBoard API reference

`ChessBoard` is exported as a named React component, plus these types:

- `ChessBoardProps`
- `ChessBoardHandle`
- `PremoveValidationArgs`
- `BoardThemePreset`
- `BoardThemeColors`
- `ChessBoardMode`
- `MoveBadgeKind`
- `MoveBadge`

It also exports `BOARD_THEME_PRESETS` for preset color lookup.

### Core props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `chess` | `Chess` | required | External chess.js instance (source of truth for moves/history). |
| `position` | `string` | required | Current FEN shown by the board. |
| `onPositionChange` | `(fen: string, move?: Move) => void` | - | Fired after board updates position. |
| `onMove` | `(move: Move) => void` | - | Fired for successful moves (including executed premoves). |
| `lastMoveBadge` | `{ kind: MoveBadgeKind; label?: string; src?: string } \| null` | - | Renders a PNG badge on the destination square of the latest move. |
| `mode` | `'play' \| 'analysis'` | `'play'` | UI mode hint for status and host integration. |
| `playerColor` | `'w' \| 'b'` | `'w'` | Side controlled by the player. |
| `initialFen` | `string` | starting position | Used by `resetToInitialFen()` ref method. |
| `relaxedPremoveMode` | `boolean` | `true` | Uses pattern-based premove planning. |

```tsx
const [mode, setMode] = useState<ChessBoardMode>('play')

<ChessBoard
  chess={chess}
  position={position}
  mode={mode}
  lastMoveBadge={mode === 'analysis' ? { kind: 'best' } : null}
/>
```

Supported badge kinds: `blunder`, `mistake`, `inaccuracy`, `miss`, `good`, `excellent`, `best`, `brilliant`, `book`, `onlyMove`.

By default, badge kinds use built-in bundled images from the package.
You can still override any badge image with `lastMoveBadge={{ kind: 'best', src: '...' }}`.

### Board theme API

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `boardThemePreset` | `'chessComClassic' \| 'brownBoard' \| 'iceBlue' \| 'custom'` | `'brownBoard'` | Select a built-in board palette. |
| `boardTheme` | `{ light?: string; dark?: string }` | - | Override light/dark square colors directly. Applied on top of the selected preset. |

Built-in presets:

| Preset | Light | Dark |
| --- | --- | --- |
| `chessComClassic` | `#EEEED2` | `#769656` |
| `brownBoard` | `#F0D9B5` | `#B58863` |
| `iceBlue` | `#DEE3E6` | `#8CA2AD` |
| `custom` | `#E8E8E8` | `#5EA01C` |

```tsx
<ChessBoard
  chess={chess}
  position={position}
  boardThemePreset="chessComClassic"
  boardTheme={{ light: '#E8E8E8', dark: '#5EA01C' }} // optional direct override
/>
```

### Premove API

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `premoves` | `PremoveState[]` | internal | Controlled premove queue. |
| `onPremovesChange` | `(premoves: PremoveState[]) => void` | - | Fired when queue changes. |
| `canQueuePremove` | `(args: PremoveValidationArgs) => boolean` | internal validation | Custom gate to allow/reject premoves. |
| `onPremoveAdd` | `(premove: PremoveState) => void` | - | Fired when a premove is queued. |
| `onPremoveExecute` | `(premove: PremoveState, move: Move) => void` | - | Fired when queued premove executes. |
| `onPremoveReject` | `(premove: PremoveState) => void` | - | Fired when a queued premove cannot execute. |

### Arrow API

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `arrows` | `Arrow[]` | internal | Controlled arrows. |
| `onArrowsChange` | `(arrows: Arrow[]) => void` | - | Fired when arrow set changes. |
| `customArrows` | `Arrow[]` | internal | Backward-compatible alias channel for controlled arrows. |
| `onCustomArrowsChange` | `(arrows: Arrow[]) => void` | - | Backward-compatible alias callback. |
| `arrowStyle` | `ArrowStyleOptions` | internal defaults | Default style for new arrows/live arrow preview. |

### Board orientation and sizing

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `flipped` | `boolean` | `false` | Controlled orientation value. |
| `onFlippedChange` | `(flipped: boolean) => void` | - | Fired when orientation changes. |
| `fillContainer` | `boolean` | `true` | Board measures parent width and fills it. |
| `squareSize` | `number` | - | Optional fixed square size (px). |
| `minSize` | `number` | `40` | Minimum square size when `fillContainer` is enabled. |
| `maxSize` | `number` | `Infinity` | Maximum square size when `fillContainer` is enabled. |
| `className` | `string` | - | Class for the board root container. |
| `showStatusBar` | `boolean` | `false` | Optional lightweight status row. |
| `showCapturedPieces` | `boolean` | `false` | Optional captured pieces rows. |

`ChessBoard` does not render built-in action UI (new game, undo, FEN loader, resize controls). Build your own controls and call the ref API.

### Captured pieces + sounds

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `capturedWhitePieces` | `string[]` | calculated from history | Optional controlled captured list. |
| `capturedBlackPieces` | `string[]` | calculated from history | Optional controlled captured list. |
| `enableSounds` | `boolean` | `true` | Toggles board sound effects. |
| `successSoundSrc` | `string` | - | Optional success cue source. |
| `playSuccessSound` | `boolean` | `false` | Plays success cue on rising edge (`false -> true`). |

### Imperative ref API

```tsx
const boardRef = useRef<ChessBoardHandle>(null)

boardRef.current?.flipBoard()    // toggle orientation
boardRef.current?.setFlipped(true)
boardRef.current?.isFlipped()    // read current orientation
boardRef.current?.goToPreviousMove()
boardRef.current?.goToNextMove()
boardRef.current?.canGoToPreviousMove()
boardRef.current?.canGoToNextMove()
boardRef.current?.setPositionFromFen('...')
boardRef.current?.resetToInitialFen()
```

### Interaction shortcuts

- Right-drag: draw/toggle arrows.
- Right-click on the same square (no drag): clear queued premoves and arrows.

### Arrow customization (pass from API)

Pass arrows from your own state (engine suggestions, last move, analysis lines).  
The board renders what you pass and also emits updates when users draw arrows.

```tsx
const [arrows, setArrows] = useState<Arrow[]>([
  { from: 'e2', to: 'e4', color: 'rgb(16,185,129)', opacity: 0.9 },
])

<ChessBoard
  chess={chess}
  position={position}
  arrows={arrows}
  onArrowsChange={setArrows}
  arrowStyle={{
    color: 'rgb(16,185,129)',
    opacity: 0.85,
    liveColor: 'rgb(59,130,246)',
    liveOpacity: 0.7,
  }}
/>
```

Use two layers of customization:

- `arrowStyle` sets the defaults for newly drawn arrows + live preview.
- `arrows` sets exact arrow positions and can override style per arrow (`from`, `to`, `color`, `opacity`, `widthScale`).

```tsx
const [arrows, setArrows] = useState([
  { from: 'e2', to: 'e4', color: '#10b981', opacity: 0.9 },
  { from: 'b1', to: 'c3', color: '#3b82f6', widthScale: 0.14 },
])

<ChessBoard
  chess={chess}
  position={position}
  arrows={arrows}
  onArrowsChange={setArrows}
/>
```

### External controls example

```tsx
import { useRef } from 'react'
import { ChessBoard, type ChessBoardHandle } from 'swiftchess'
import 'swiftchess/style.css'

const boardRef = useRef<ChessBoardHandle>(null)

<button onClick={() => boardRef.current?.goToPreviousMove()}>Prev</button>
<button onClick={() => boardRef.current?.goToNextMove()}>Next</button>
<button onClick={() => boardRef.current?.flipBoard()}>Flip</button>

<div style={{ width: 520 }}>
  <ChessBoard ref={boardRef} chess={chess} position={position} />
</div>
```

### Premove hooks

Premove state can be controlled and validated via your own logic:

- `premoves`, `onPremovesChange`
- `canQueuePremove`
- `onPremoveAdd`, `onPremoveExecute`, `onPremoveReject`

With `relaxedPremoveMode` (default: `true`), premove highlight squares are shown by piece pattern (ignoring blockers) so multi-piece/multi-turn premove planning is easier.

### Captured pieces from API

You can provide captured pieces directly:

- `capturedWhitePieces`
- `capturedBlackPieces`

### Board sounds

Built-in sounds are bundled in the package (`move`, `capture`, `castle`, `check`, `end`).

Use `enableSounds` to toggle all board sounds, and optionally pass `successSoundSrc` as a separate success cue:

```tsx
const [soundEnabled, setSoundEnabled] = useState(true)

<ChessBoard
  chess={chess}
  position={position}
  enableSounds={soundEnabled}
  successSoundSrc="/success.mp3"
/>
```

`successSoundSrc` is **not auto-played on every move**.  
Trigger it explicitly (for puzzle solved, etc.) with `playSuccessSound` on a rising edge (`false -> true`).

```tsx
<ChessBoard
  chess={chess}
  position={position}
  successSoundSrc="/success.mp3"
  playSuccessSound={puzzleSolved}
/>
```

The demo app (`src/App.tsx`) currently includes a random black reply move for testing.
