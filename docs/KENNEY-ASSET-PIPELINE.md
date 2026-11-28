# Kenney Medieval RTS → Unicode glyph pipeline

## Source and license

DOMINIUM uses selected graphics from **Kenney – Medieval RTS (120+)**:
- Source: https://opengameart.org/content/medieval-rts-120
- Author: Kenney (Kenney Vleugels)
- License: CC0 1.0; the original license file is preserved in `assets/kenney-medieval-rts/License.txt`.
- The source atlas and XML metadata are stored in `assets/kenney-medieval-rts/`.

The original PNG is an authoring input only. It is not loaded by the game and is not shipped as a runtime texture.

## Conversion

Run from the repository root:

```bash
node scripts/convert-kenney-sprites.mjs
```

The converter reads the RGBA atlas and its XML coordinates, crops each named sprite, downsamples it, samples the original colors and writes Unicode glyph grids to `src/engine/kenney-sprites.generated.ts`.

The runtime helper `src/engine/kenney-sprites.ts` draws those grids using ordinary glyph instances. The game therefore remains a colored Unicode/ASCII renderer; it does not display PNGs, Canvas sprites, or bitmap textures.

Current generated coverage:
- 23 structure sprites
- 24 unit sprites (six visual variants in four palette/faction rows)

## Integration

- Combat squads use the corresponding unit sprite family while retaining close, standard, and strategic LODs, tactical class marks, flags, and group counts.
- Town buildings, storage buildings, and matching production buildings use the closest available Kenney structure art.
- Buildings without a visually suitable source asset retain their existing glyph representation instead of being assigned an unrelated sprite.

The structure and unit atlas identifiers are kept stable so visual assignments can be refined without changing simulation or save data.
