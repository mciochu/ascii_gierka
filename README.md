# DOMINIUM — ASCII RTS

A browser-based medieval real-time strategy game built entirely from individually positioned Unicode glyphs.

## Visual direction

The world uses a top-down camera and a freeform typographic renderer. It is not a terminal grid and it is not a screenshot made from text rows: every visible terrain mark, tree, wall, building detail, soldier and effect is a text glyph with its own world position, size, colour, opacity, rotation and animation state.

The visual language is inspired by medieval strategy games such as Stronghold Crusader: castle building, village economy, armies, sieges and rival lords.

**No image assets, sprite sheets, SVG illustrations, 3D models or bitmap artwork are used for the game world.** The renderer draws Unicode characters through PixiJS.

## Technology

- PixiJS 8 for GPU-accelerated rendering and camera transforms.
- TypeScript for the simulation and game systems.
- Vite for development and production builds.
- Static browser output; no application server is required for the first playable prototype.

## Development

```bash
npm install
npm run dev
npm run verify
```

Production output is generated in `dist/`.

## Controls

- Drag with the middle or right mouse button to pan the map.
- Use the mouse wheel to zoom.
- Select a unit or building by clicking it.
- Select **MOVE**, then click the map to issue a movement order to a selected unit.
- Select **BUILD**, then choose a watchtower and click the map to place it.
- WASD or arrow keys pan the camera.

## Design principles

1. Freeform glyph placement, not fixed text rows.
2. Gameplay coordinates are separate from visual glyph coordinates.
3. Rendering and simulation remain separate systems.
4. Glyph density is budgeted and can use level-of-detail rules as the world grows.
5. The game remains readable at multiple zoom levels.
