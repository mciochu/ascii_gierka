# DOMINIUM — ASCII RTS

A browser-based medieval real-time strategy game built entirely from individually positioned Unicode glyphs.

## Visual direction

The world uses a top-down camera and a freeform typographic renderer. It is not a terminal grid and it is not a screenshot made from text rows: every visible terrain mark, tree, wall, building detail, soldier and effect is a text glyph with its own world position, size, colour, opacity, rotation and animation state.

The visual direction is a northern-European medieval world inspired by the Teutonic Order and the Polish–Teutonic frontier: brick-and-limestone castles, timber villages, white mantles with black crosses, red heraldic details, guild workshops, abbeys, banners and medieval field armies. The game keeps its Stronghold-style economy and siege-strategy systems, but the art identity is now distinctly Teutonic rather than generic Crusader desert fantasy.

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

- **Left click** a unit or building to select it.
- **Left-drag** across the battlefield to box-select several friendly units.
- **Shift + left click/drag** adds to the selection; **Ctrl + left click/drag** toggles objects in it.
- **Double-click** a friendly unit to select all visible friendly units of the same type.
- **Right click** open ground to move the selected units in formation.
- **Shift + right click** queues another movement order.
- **Right click** an enemy to attack it.
- **A** enables attack-move; units engage enemies they encounter on the way.
- **S** stops selected units; **H** makes them hold position.
- **Ctrl + 1–9** saves a control group; **1–9** selects it.
- **B** enters watchtower placement; click free ground to build.
- **Middle mouse drag** pans the map; the mouse wheel zooms.
- **Arrow keys** move the camera; **Esc** returns to selection mode.

The map is rendered on a pure black field. Terrain, water, wood, stone, buildings, friendly troops and enemies use differently coloured Unicode glyphs. Glyph positions are continuous world coordinates and are not restricted to terminal rows or a tile grid.

## Design principles

1. Freeform glyph placement, not fixed text rows.
2. Gameplay coordinates are separate from visual glyph coordinates.
3. Rendering and simulation remain separate systems.
4. Glyph density is budgeted and can use level-of-detail rules as the world grows.
5. The game remains readable at multiple zoom levels.


## VPS deployment

The production service is isolated from other applications:

- Source checkout: `/home/ubuntu/services/ascii_gierka/repo`
- Verified releases: `/home/ubuntu/services/ascii_gierka/releases/`
- Active build: `/home/ubuntu/services/ascii_gierka/current`
- Public game URL: `http://57.128.245.116:4173/dominium/`
- Public entry port: `4173` (shared with Karcianka using a dedicated `/dominium/` route)
- Standalone diagnostic port: `4175` (may be filtered by the VPS provider firewall)
- Watcher: checks public GitHub `main` every 60 seconds
- Deployment: `npm ci`, `npm run verify`, then an atomic symlink switch
- Autostart: per-user cron `@reboot` entry

Manual deployment:

```bash
bash /home/ubuntu/services/ascii_gierka/bin/deploy-once.sh
```

Install or verify autostart:

```bash
bash /home/ubuntu/services/ascii_gierka/bin/install-autostart.sh
```

Logs are stored in `/home/ubuntu/services/ascii_gierka/logs/`. The watcher and static server are independent of Karcianka.
