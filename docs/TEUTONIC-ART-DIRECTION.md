# DOMINIUM — Teutonic Order visual direction

## Art identity

The former generic medieval / desert-Crusader palette is replaced by a northern-European medieval frontier associated with the Teutonic Order and the Polish–Teutonic borderlands. This is a visual direction, not a claim that every structure or unit is an exact archaeological reconstruction.

Core visual anchors:
- White mantles and banners bearing a black cross for the Order, with restrained red heraldic edging.
- Separate Polish heraldic treatment: red-and-white cloth and warm gold trim.
- Enemy/raider treatment: weathered iron, leather, earth and muted ochre; no accidental Order cross.
- Brick-red masonry, pale limestone, dark slate roofs, exposed timber, iron fittings and aged gold.
- Temperate forests, meadows, muddy tracks, rivers, rocky ridges, cultivated fields and marshes instead of a bright Arabian/desert visual language.
- Black world background remains intentional; local colour, glyph density and lighting provide the sense of depth.

## Rendering constraints

- All game-world visuals are individually positioned Unicode glyphs rendered through the existing PixiJS/Effulgence pipeline.
- No runtime PNG, sprite sheet, Canvas image, SVG illustration, 3D model or texture artwork.
- Asset miniatures use irregularly offset glyph cells rather than fixed terminal rows. The compact source patterns are only construction guides; the renderer applies organic positional drift.
- The logic grid, collision, economy, entity IDs, simulation state, saves and controls are independent of art.
- Close/standard/strategic LOD must remain supported. Tactical count markers and selection feedback stay legible.

## Asset families

`src/engine/teutonic-art.ts` is the central visual catalogue. Current families include:

### Fortifications and military buildings
- Keep / donjon, watchtower, curtain wall, gate, barracks, stables and armoury.
- Stone courses, crenellations, dark rooflines, timber gates and white Order pennants.
- Future assets to add: gatehouse, barbican, moat bridge, siege tower, mangonel, trebuchet, palisade, engineer camp, dog kennel, oil cauldron and fortified monastery.

### Town and religion
- Hovels, chapel, parish church, cathedral, inn, garden and gallows.
- Steep timber roofs, pale masonry, narrow dark openings, bell towers and crosses.
- Future assets: bakehouse, well, bathhouse, hospital, market square, tavern signs, cemetery, monastery cloister and scriptorium.

### Industry and agriculture
- Woodcutter, quarry, mine, pitch works, orchard, fields, mill, bakery, brewery, smithy, tannery and market.
- Roofs and frames use the same material palette as the castle; workshops should read as working places rather than abstract icons.
- Future assets: charcoal burner, lime kiln, saw pit, cooper, weaver, ropewalk, stable yard, windmill sails and granary hoist.

### People and army
- Knight, sergeant, spearman, crossbowman, archer, cavalry, villager, priest and lord.
- Distinct silhouettes for helmet, mail/plate, shield, bow/crossbow, spear and mounted troops.
- Order, Polish and enemy heraldry is passed as a faction palette; simulation classes and recruitment costs are unchanged.
- Future assets: Teutonic grand master, banner bearer, priest, scout, engineer, miner, wagoner, peasant woman, ox cart, wounded soldier, siege crew and messenger.

## Colour tokens

| Material | Colour intent |
|---|---|
| Limestone | pale grey-beige highlights |
| Fieldstone | muted grey-green |
| Brick | dark red / burnt terracotta |
| Roof | slate charcoal |
| Timber | warm brown |
| Iron | cool weathered grey |
| Order cloth | aged white with black cross and restrained red trim |
| Polish cloth | red and white with gold accents |
| Vegetation | deep temperate greens and olive |
| Ground | muted soil, grass and ochre |
| UI accent | aged gold and oxblood red |

## UI

The interface uses the same visual language as the map: near-black iron panels, warm stone text, aged-gold active states and restrained oxblood warnings. Avoid electric cyan, neon green, sci-fi borders, glossy gradients and futuristic iconography.

## Validation checklist

1. All asset IDs resolve to a glyph composition.
2. Faction variants never leak the wrong heraldry.
3. No new image or sprite runtime dependency is introduced.
4. TypeScript, unit tests and production build pass.
5. Existing save files, entity IDs, simulation rules and input controls remain unchanged.
6. Visual QA at wide desktop and narrow mobile widths; check close, standard and strategic zoom.