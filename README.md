# SwiftChess

SwiftChess is a lightweight React chessboard component with fast drag interactions, premoves, and drawable arrows.

## Live demo

Explore the interactive playground, live examples, and package documentation:

**https://swiftches.lucarioqh5.workers.dev/**

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

Run regression tests and the distributable bundle checks:

```bash
npm test
npm run check:bundle
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

`ChessBoard` consumes your own `Chess` instance and `position` string instead of owning standard game state.

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
- `ChessBoardExplorerMode`
- `MoveBadgeKind`
- `MoveBadge`
- `MoveBadgeByPly`
- `Arrow`
- `ArrowCommitEvent`
- `LiveArrow`

It also exports `BOARD_THEME_PRESETS` for preset color lookup.
It exports `getChessBoardHistory(chess)` for history that includes synthetic god-mode moves.

The published stylesheet scopes its reset and utility state beneath `.swiftchess-root`, so importing it does not reset the host application. The optimized ESM build keeps badge and sound media as separate cacheable files; the legacy CommonJS build embeds those files so browser bundlers do not resolve them against the consuming page.

### Core props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `chess` | `Chess` | required | External chess.js instance. It remains the source of truth for standard legal games; see the god-mode history note below. |
| `position` | `string` | required | Current FEN shown by the board. |
| `onPositionChange` | `(fen: string, move: Move \| undefined, history: readonly Move[]) => void` | - | Fired after board updates position, with the board-visible history. |
| `onMove` | `(move: Move, history: readonly Move[]) => void` | - | Fired for successful moves (including executed premoves), with the board-visible history. |
| `onHistoryChange` | `(history: readonly Move[]) => void` | - | Fired whenever board navigation or a move changes the visible history. |
| `lastMoveBadge` | `{ kind: MoveBadgeKind; label?: string; src?: string } \| null` | - | Renders a PNG badge on the destination square of the latest move. |
| `moveBadges` | `{ ply: number; badge: MoveBadge }[]` | - | Host-provided move classifications keyed by 1-based ply. Automatically follows previous/next navigation. |
| `mode` | `'play' \| 'analysis'` | `'play'` | UI mode hint for status and host integration. |
| `playerColor` | `'w' \| 'b'` | `'w'` | Side controlled by the player. |
| `explorerMode` | `'off' \| 'normal' \| 'god'` | `'off'` | Controls whether explorer interaction can move non-`playerColor` pieces. |
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

### Explorer mode

Set `explorerMode="normal"` when the board should behave like an opening explorer instead of a player-only board. In normal explorer mode, users can click or drag the side whose turn it is, even when that side does not match `playerColor`; moves still follow the legal turn in the current FEN.

Use `explorerMode="god"` only when you intentionally want sandbox behavior where either side can be selected regardless of turn. God mode still uses chess.js legal moves for the selected piece, but it bypasses the FEN turn by evaluating from that piece's side.

Because chess.js cannot represent an out-of-turn sequence in its native move stack, an off-turn god-mode move resets `chess.history()`. SwiftChess keeps a separate timeline keyed to the supplied `Chess` instance, preserves it across board remounts, and supplies it to `onMove`, `onPositionChange`, and `onHistoryChange`. Outside callbacks, read the same timeline with `getChessBoardHistory(chess)` or `boardRef.current?.getHistory()` instead of `chess.history()` when god mode is active.

```tsx
<ChessBoard
  chess={chess}
  position={position}
  onPositionChange={setPosition}
  explorerMode="normal"
/>
```

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
| `overlayArrows` | `Arrow[]` | `[]` | Read-only host hints such as engine, explorer, or best-move arrows. User drawing never mutates this list. |
| `arrows` | `Arrow[]` | internal | Controlled user-drawn annotation arrows. |
| `defaultArrows` | `Arrow[]` | `[]` | Initial uncontrolled user-drawn annotation arrows. |
| `onArrowsChange` | `(arrows: Arrow[]) => void` | - | Fired when user-drawn arrows change. |
| `onArrowCommit` | `(event: ArrowCommitEvent) => void` | - | Fired for user arrow `add`, `remove`, or `clear` actions. |
| `onLiveArrowChange` | `(arrow: LiveArrow \| null) => void` | - | Observes the transient right-drag preview. It is not persisted. |
| `customArrows` | `Arrow[]` | internal | Backward-compatible alias for controlled user-drawn arrows. |
| `onCustomArrowsChange` | `(arrows: Arrow[]) => void` | - | Backward-compatible alias callback. |
| `arrowStyle` | `ArrowStyleOptions` | internal defaults | Default style for committed user arrows. |
| `overlayArrowStyle` | `ArrowStyleOptions` | internal defaults | Default style for overlay arrows. |
| `liveArrowStyle` | `ArrowStyleOptions` | internal defaults | Default style for the live preview. |

### Board orientation and sizing

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `flipped` | `boolean` | `false` | Controlled orientation value. |
| `onFlippedChange` | `(flipped: boolean) => void` | - | Fired when orientation changes. |
| `boardSize` | `number` | - | Optional controlled board size in pixels. |
| `onBoardSizeChange` | `(boardSize: number, squareSize: number) => void` | - | Fired while the user drags the resize handle. |
| `resizable` | `boolean` | `false` | Shows a bottom-right drag handle for user-controlled board resizing. |
| `fillContainer` | `boolean` | `false` | Board measures parent width and fills it. Ignored when `boardSize` or `squareSize` controls sizing. |
| `squareSize` | `number` | - | Optional fixed square size (px). |
| `minSize` | `number` | `40` | Minimum square size when `fillContainer` is enabled. |
| `maxSize` | `number` | `Infinity` | Maximum square size when `fillContainer` is enabled. |
| `className` | `string` | - | Class for the board root container. |
| `showStatusBar` | `boolean` | `false` | Optional lightweight status row. |
| `showCapturedPieces` | `boolean` | `false` | Optional captured pieces rows. |
| `showLegalMoves` | `boolean` | `true` | Shows legal target indicators for the selected piece. |

Use `resizable` when the package should render its own resize handle:

```tsx
const [boardSize, setBoardSize] = useState(560)

<ChessBoard
  chess={chess}
  position={position}
  boardSize={boardSize}
  onBoardSizeChange={setBoardSize}
  resizable
  minSize={36}
  maxSize={96}
/>
```

`minSize` and `maxSize` are square sizes, so `minSize={36}` means a 288px minimum board.

`ChessBoard` does not render built-in action UI (new game, undo, FEN loader). Build your own controls and call the ref API.

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
boardRef.current?.getHistory()
boardRef.current?.getCurrentPly()
boardRef.current?.setPositionFromFen('...')
boardRef.current?.resetToInitialFen()
```

### Interaction shortcuts

- Right-drag: draw/toggle arrows.
- Right-click on the same square (no drag): toggle a circle marker.
- Left-click a neutral square: clear queued premoves and user annotations.

### Arrow customization (pass from API)

Use `overlayArrows` for read-only engine/explorer hints and `arrows` for user-drawn annotations. User drawing emits changes only for `arrows`, so it cannot delete host hints.

```tsx
const [userArrows, setUserArrows] = useState<Arrow[]>([])
const engineArrows: Arrow[] = [
  { from: 'e2', to: 'e4' },
  { from: 'g1', to: 'f3', opacity: 0.45 },
]

<ChessBoard
  chess={chess}
  position={position}
  overlayArrows={engineArrows}
  arrows={userArrows}
  onArrowsChange={setUserArrows}
  onArrowCommit={(event) => {
    console.log(event.action, event.arrow)
  }}
  arrowStyle={{
    color: 'rgb(16,185,129)',
    opacity: 0.85,
  }}
  overlayArrowStyle={{
    color: 'rgb(37,99,235)',
    opacity: 0.55,
  }}
  liveArrowStyle={{
    color: 'rgb(249,115,22)',
    opacity: 0.65,
  }}
/>
```

Arrows can override style per item:

```tsx
const engineArrows: Arrow[] = [
  { from: 'e2', to: 'e4', color: '#10b981', opacity: 0.9 },
  { from: 'b1', to: 'c3', color: '#3b82f6', widthScale: 0.14 },
]

<ChessBoard
  chess={chess}
  position={position}
  overlayArrows={engineArrows}
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
Queued premoves also render a preview piece map while it is the opponent's turn, so the moved piece appears on its planned destination instead of staying on the original square.

### Move classification badges

Use `moveBadges` for analysis-board move classifications across a navigable game. Badges are keyed by 1-based ply, so `goToPreviousMove()` and `goToNextMove()` automatically show the classification for the currently visible last move.

```tsx
const moveBadges: MoveBadgeByPly[] = [
  { ply: 1, badge: { kind: 'book' } },
  { ply: 2, badge: { kind: 'best' } },
  { ply: 3, badge: { kind: 'brilliant' } },
]

<ChessBoard
  chess={chess}
  position={position}
  mode="analysis"
  moveBadges={moveBadges}
/>
```

For simple latest-move displays, `lastMoveBadge` still works and overrides `moveBadges` when provided.

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
