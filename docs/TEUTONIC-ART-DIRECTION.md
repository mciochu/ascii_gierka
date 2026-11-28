# DOMINIUM — visual redesign: Teutonic frontier, c. 1320

## Art direction

A northern-European frontier town and fortress at the height of the medieval Teutonic state. The visual identity is deliberately grounded rather than fantasy: pale weathered limestone, rough fieldstone, deep brick red, steep slate roofs, dark timber, worn iron, aged parchment, forest greens and restrained gilt. The black cross on white cloth is a strong, readable Order identifier, not a decoration placed on every object.

## Rendering rules

- The world remains a live Unicode-glyph renderer through the existing PixiJS/Effulgence GPU instancing path. No PNG, bitmap texture, sprite image, SVG illustration or Canvas artwork is introduced.
- Architecture and people are layered glyph compositions with offset shadows, material colours, highlights, depth values and small hand-authored silhouette details.
- The map remains black/dark at its outer void, with irregular temperate forest, marsh, river, meadow, cultivated plots, paths and rocky ridges inside the playable diamond.
- Art is presentation-only. Simulation, movement, collision, economy, entity IDs, saved state and controls do not depend on visual patterns.
- Zoom LOD must keep close, standard and strategic representations readable; tactical group counts remain legible.

## Asset library

The main catalogue is `src/engine/teutonic-art.ts`. It contains more than 60 distinct architectural, production, military, civilian, transport, nature and siege compositions. Major families include:

- Fortification: keep, watchtower, wall, gate, barbican, palisade, drawbridge and bridge.
- Town and religion: hovels, manor, chapel, church, cathedral, monastery, inn, infirmary, well and shrine.
- Industry and food: woodcutter, hunter, quarry, mine, pitch works, orchards, grain and hop fields, dairy farm, mill, bakery, brewery, smithy, bowyer, poleturner, tannery, armourer, ox tether and market.
- Siege and transport: trebuchet, mangonel, battering ram, siege tower, wagon and ox cart.
- People and army: knight, sergeant, spearman, crossbowman, archer, cavalry, villager, priest, lord, banner bearer, scout, engineer, miner and messenger.

Every catalogue pattern renders through independently positioned glyphs. Composition metrics and a regression suite check the library breadth, minimum detail, valid placement and faction distinction.

## Faction heraldry

- Teutonic Order: aged white cloth, black cross, restrained oxblood edging and cool weathered iron.
- Polish forces: red/white cloth with horse-device treatment and warm gold trim; no black Order cross.
- Raiders and hostile forces: muted ochre, brown leather, dark iron and oxblood; no Order cross.
- Neutral townsfolk: parchment, wool, flax, leather and timber tones.

## Interface materials

The HUD is built as dark iron/wooden framing with brass fittings, carved shield-like category controls and parchment document panels. Oxblood marks danger; muted moss indicates healthy state. Electric cyan, neon green, sci-fi styling and bright blue selection accents are excluded.

## QA

Run `npm run verify` and `git diff --check`. Confirm that all catalogue assets render, faction insignia do not leak across sides, all 119 existing tests remain green, mobile HUD stays within the 100%-height layout, and no simulation/save identifiers have changed.