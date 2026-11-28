[Reading 125 lines from start (total: 125 lines, 0 remaining)]

#!/usr/bin/env node
/**
 * Converts Kenney Medieval RTS PNG atlas sprites into colored Unicode glyph grids.
 * Source pack: https://opengameart.org/content/medieval-rts-120
 * License: CC0 1.0 (Kenney).
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const root = path.resolve("assets/kenney-medieval-rts");
const atlasPath = path.join(root, "medievalRTS_spritesheet.png");
const xmlPath = path.join(root, "medievalRTS_spritesheet.xml");
const outputPath = path.resolve("src/engine/kenney-sprites.generated.ts");

function decodePng(file) {
  const input = fs.readFileSync(file);
  let offset = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (offset < input.length) {
    const length = input.readUInt32BE(offset);
    const type = input.toString("ascii", offset + 4, offset + 8);
    const data = input.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
  }
  if (bitDepth !== 8 || colorType !== 6) throw new Error("Expected non-interlaced RGBA8 PNG.");
  const packed = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const pixels = Buffer.alloc(height * stride);
  let cursor = 0;
  for (let y = 0; y < height; y++) {
    const filter = packed[cursor++];
    for (let x = 0; x < stride; x++) {
      let value = packed[cursor++];
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upperLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upperLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upperLeft;
      }
      pixels[y * stride + x] = value & 255;
    }
  }
  return { width, height, pixels };
}

function parseSprites(xml) {
  const sprites = [];
  const pattern = /<SubTexture name="([^"]+)" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"\/>/g;
  let match;
  while ((match = pattern.exec(xml))) {
    sprites.push({
      name: match[1].replace(/\.png$/, ""),
      x: Number(match[2]), y: Number(match[3]),
      width: Number(match[4]), height: Number(match[5])
    });
  }
  return sprites;
}

function convertSprite(atlas, sprite, maxWidth, maxHeight) {
  const aspect = sprite.width / sprite.height;
  const height = Math.min(maxHeight, Math.max(5, Math.round(Math.sqrt(maxWidth * maxHeight / Math.max(aspect, 0.1)))));
  const width = Math.min(maxWidth, Math.max(4, Math.round(height * aspect / 0.68)));
  const rows = [], colors = [];
  for (let gy = 0; gy < height; gy++) {
    let glyphRow = "";
    const colorRow = [];
    for (let gx = 0; gx < width; gx++) {
      const x0 = Math.floor(gx * sprite.width / width);
      const x1 = Math.max(x0 + 1, Math.floor((gx + 1) * sprite.width / width));
      const y0 = Math.floor(gy * sprite.height / height);
      const y1 = Math.max(y0 + 1, Math.floor((gy + 1) * sprite.height / height));
      let alpha = 0, red = 0, green = 0, blue = 0, samples = 0;
      for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
        const i = ((sprite.y + sy) * atlas.width + sprite.x + sx) * 4;
        const a = atlas.pixels[i + 3] / 255;
        alpha += a; red += atlas.pixels[i] * a; green += atlas.pixels[i + 1] * a; blue += atlas.pixels[i + 2] * a;
        samples++;
      }
      const coverage = alpha / samples;
      if (coverage < 0.12 || alpha === 0) {
        glyphRow += " ";
        colorRow.push("");
        continue;
      }
      const r = Math.round(red / alpha), g = Math.round(green / alpha), b = Math.round(blue / alpha);
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const glyph = coverage < 0.24 ? "·" : coverage < 0.48 ? "░" : coverage < 0.72 ? "▒" : luminance > 0.76 ? "░" : luminance > 0.48 ? "▒" : "█";
      glyphRow += glyph;
      colorRow.push("#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join(""));
    }
    rows.push(glyphRow);
    colors.push(colorRow);
  }
  return { width, height, rows, colors };
}

const atlas = decodePng(atlasPath);
const sprites = parseSprites(fs.readFileSync(xmlPath, "utf8"));
const generated = {};
for (const sprite of sprites) {
  if (sprite.name.startsWith("medievalStructure_")) generated[sprite.name] = convertSprite(atlas, sprite, 18, 12);
  else if (sprite.name.startsWith("medievalUnit_")) generated[sprite.name] = convertSprite(atlas, sprite, 8, 8);
}
const source = [
  "/* Generated from Kenney Medieval RTS CC0 atlas by scripts/convert-kenney-sprites.mjs. Do not edit by hand. */",
  "export interface KenneyGlyphSprite { width: number; height: number; rows: readonly string[]; colors: readonly (readonly string[])[]; }",
  "export const KENNEY_GLYPH_SPRITES: Readonly<Record<string, KenneyGlyphSprite>> = ",
  JSON.stringify(generated) + ";"
].join("\n");
fs.writeFileSync(outputPath, source + "\n");
console.log(`Generated ${Object.keys(generated).length} sprites from ${sprites.length} atlas entries: ${outputPath}`);

[executed on device: vps-d5543227 (f98401a2-4f25-449c-a7ff-f53738afd282)]