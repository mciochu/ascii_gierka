import { Application, Container, Text } from "pixi.js";
import "./style.css";
import { addGlyph } from "./engine/glyph";
import { createWatchtower, createWorld, WORLD_SIZE, type GameEntity } from "./engine/world";

type Mode = "select" | "move" | "build";

const viewport = document.querySelector<HTMLDivElement>("#map-viewport");
const statusMessage = document.querySelector<HTMLElement>("#status-message");
const modeLabel = document.querySelector<HTMLElement>("#mode-label");
const mapHint = document.querySelector<HTMLElement>("#map-hint");
const zoomLabel = document.querySelector<HTMLElement>("#zoom-label");
const selectionContent = document.querySelector<HTMLElement>("#selection-content");
const inspector = document.querySelector<HTMLElement>(".inspector");

if (!viewport || !statusMessage || !modeLabel || !mapHint || !zoomLabel || !selectionContent || !inspector) {
  throw new Error("Game interface is missing required elements.");
}

const goldValue = document.querySelector<HTMLElement>("#gold-value");
const foodValue = document.querySelector<HTMLElement>("#food-value");
const woodValue = document.querySelector<HTMLElement>("#wood-value");
const stoneValue = document.querySelector<HTMLElement>("#stone-value");

const app = new Application();
await app.init({
  background: "#18271e",
  resizeTo: viewport,
  antialias: true,
  autoDensity: true,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  preference: "webgl"
});

const canvas = app.canvas;
canvas.setAttribute("aria-label", "Mapa królestwa DOMINIUM");
canvas.style.position = "absolute";
canvas.style.inset = "0";
canvas.style.width = "100%";
canvas.style.height = "100%";
viewport.insertBefore(canvas, viewport.firstChild);

const worldRoot = new Container();
worldRoot.sortableChildren = true;
app.stage.addChild(worldRoot);
const world = createWorld(worldRoot);
const entities = world.entities;

let zoom = 0.68;
let mode: Mode = "select";
let selectedEntity: GameEntity | null = null;
let selectionGlyph: Text | null = null;
let buildType: "watchtower" | null = null;
let towerCounter = 0;
let paused = false;
let gold = 1240;
let food = 860;
let wood = 340;
let stone = 210;
let dragState: { pointerId: number; x: number; y: number } | null = null;
const keysDown = new Set<string>();

function setStatus(message: string): void {
  statusMessage.textContent = message;
}

function setMode(nextMode: Mode): void {
  mode = nextMode;
  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });

  const labels: Record<Mode, string> = {
    select: "TRYB: ZAZNACZANIE",
    move: "TRYB: WYDAWANIE ROZKAZÓW",
    build: "TRYB: BUDOWA"
  };
  const hints: Record<Mode, string> = {
    select: "WYBIERZ ODDZIAŁ LUB BUDYNEK",
    move: "WSKAŻ MIEJSCE DOCELOWE NA MAPIE",
    build: "WSKAŻ MIEJSCE POD WIEŻĘ STRAŻNICZĄ"
  };
  modeLabel.textContent = labels[mode];
  mapHint.textContent = hints[mode];
  canvas.style.cursor = mode === "select" ? "crosshair" : mode === "move" ? "alias" : "copy";
}

function setResources(): void {
  if (goldValue) goldValue.textContent = gold.toLocaleString("pl-PL");
  if (foodValue) foodValue.textContent = food.toLocaleString("pl-PL");
  if (woodValue) woodValue.textContent = wood.toLocaleString("pl-PL");
  if (stoneValue) stoneValue.textContent = stone.toLocaleString("pl-PL");
}

function updateSelectionPanel(entity: GameEntity | null): void {
  if (!entity) {
    selectionContent.innerHTML = `
      <div class="empty-selection">
        <span>⌖</span>
        <b>Nie wybrano obiektu</b>
        <p>Zaznacz oddział lub budynek na mapie, aby wyświetlić szczegóły i dostępne rozkazy.</p>
      </div>`;
    return;
  }

  const health = Math.max(0, Math.min(100, entity.health));
  const strength = entity.kind === "unit" ? `<div class="object-meta"><span>STAN ODDZIAŁU</span><span>${entity.count ?? 0} ŻOŁNIERZY</span></div>` : "";
  const moveButton = entity.kind === "unit"
    ? '<button class="command-button" id="issue-move" type="button">➤ &nbsp; WYDAJ ROZKAZ MARSZU</button>'
    : '<div class="object-meta"><span>STATUS</span><span>OBIEKT SOJUSZNICZY</span></div>';

  selectionContent.innerHTML = `
    <div class="selected-object">
      <div class="object-type">${entity.role}</div>
      <h2>${entity.name}</h2>
      <p>${entity.description}</p>
      <div class="object-health"><span style="width:${health}%"></span></div>
      <div class="object-meta"><span>WYTRZYMAŁOŚĆ</span><span>${health}%</span></div>
      ${strength}
      ${moveButton}
    </div>`;

  document.querySelector<HTMLButtonElement>("#issue-move")?.addEventListener("click", () => {
    setMode("move");
    setStatus(`Rozkaz dla oddziału: ${entity.name}. Wskaż miejsce docelowe.`);
  });
}

function selectEntity(entity: GameEntity | null): void {
  selectedEntity = entity;
  world.layers.effects.removeChildren();
  selectionGlyph = null;

  if (entity) {
    selectionGlyph = addGlyph(world.layers.effects, {
      char: "◎",
      x: entity.x,
      y: entity.y,
      size: 48,
      color: "#e5cb89",
      alpha: 0.95,
      weight: "bold",
      stroke: "#253329",
      strokeWidth: 1
    });
    updateSelectionPanel(entity);
    setStatus(`Wybrano: ${entity.name}.`);
    inspector.classList.add("open");
  } else {
    updateSelectionPanel(null);
  }
}

function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (screenX - rect.left - worldRoot.position.x) / zoom,
    y: (screenY - rect.top - worldRoot.position.y) / zoom
  };
}

function findEntityAt(x: number, y: number): GameEntity | null {
  let nearest: GameEntity | null = null;
  let nearestDistance = Infinity;
  for (const entity of entities) {
    const dx = entity.x - x;
    const dy = entity.y - y;
    const distance = Math.hypot(dx, dy);
    const radius = entity.kind === "building" ? 83 : 62;
    if (distance < radius && distance < nearestDistance) {
      nearest = entity;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function placeWatchtower(x: number, y: number): void {
  if (wood < 70 || stone < 30) {
    setStatus("Brakuje surowców. Wieża wymaga 70 drewna i 30 kamienia.");
    return;
  }
  if (x < 40 || y < 40 || x > WORLD_SIZE.width - 40 || y > WORLD_SIZE.height - 40) {
    setStatus("Nie można budować poza granicami posiadłości.");
    return;
  }

  wood -= 70;
  stone -= 30;
  towerCounter += 1;
  const tower = createWatchtower(world.layers.structures, x, y, towerCounter);
  entities.push(tower);
  setResources();
  buildType = null;
  setMode("select");
  selectEntity(tower);
  setStatus("Wieża strażnicza wzniesiona. Nowy posterunek czuwa nad okolicą.");
}

function handleMapClick(event: PointerEvent): void {
  if (event.button !== 0 || dragState) return;
  const point = screenToWorld(event.clientX, event.clientY);

  if (mode === "build" && buildType === "watchtower") {
    placeWatchtower(point.x, point.y);
    return;
  }

  if (mode === "move") {
    if (!selectedEntity || selectedEntity.kind !== "unit") {
      setStatus("Najpierw wybierz oddział, któremu chcesz wydać rozkaz.");
      setMode("select");
      return;
    }
    selectedEntity.moveTarget = {
      x: Math.max(25, Math.min(WORLD_SIZE.width - 25, point.x)),
      y: Math.max(25, Math.min(WORLD_SIZE.height - 25, point.y))
    };
    setStatus(`Rozkaz marszu: ${selectedEntity.name} rusza do wyznaczonego punktu.`);
    setMode("select");
    return;
  }

  const entity = findEntityAt(point.x, point.y);
  if (entity) {
    selectEntity(entity);
  } else {
    selectEntity(null);
    inspector.classList.remove("open");
    setStatus("Nie wybrano obiektu. Mapa pozostaje pod twoją kontrolą.");
  }
}

canvas.addEventListener("pointerdown", (event: PointerEvent) => {
  const wantsPan = event.button === 1 || event.button === 2 || keysDown.has(" ");
  if (wantsPan) {
    dragState = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
    event.preventDefault();
    return;
  }
  handleMapClick(event);
});

canvas.addEventListener("pointermove", (event: PointerEvent) => {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  const dx = event.clientX - dragState.x;
  const dy = event.clientY - dragState.y;
  worldRoot.position.x += dx;
  worldRoot.position.y += dy;
  dragState.x = event.clientX;
  dragState.y = event.clientY;
});

function endDrag(event: PointerEvent): void {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  dragState = null;
  canvas.style.cursor = mode === "select" ? "crosshair" : mode === "move" ? "alias" : "copy";
}
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

function zoomAt(nextZoom: number, clientX?: number, clientY?: number): void {
  const clamped = Math.max(0.34, Math.min(1.55, nextZoom));
  if (Math.abs(clamped - zoom) < 0.001) return;
  const rect = canvas.getBoundingClientRect();
  const px = clientX === undefined ? rect.width / 2 : clientX - rect.left;
  const py = clientY === undefined ? rect.height / 2 : clientY - rect.top;
  const worldX = (px - worldRoot.position.x) / zoom;
  const worldY = (py - worldRoot.position.y) / zoom;
  zoom = clamped;
  worldRoot.scale.set(zoom);
  worldRoot.position.set(px - worldX * zoom, py - worldY * zoom);
  zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
}

function centerCamera(): void {
  const focusX = 1190;
  const focusY = 915;
  worldRoot.position.set(
    viewport.clientWidth / 2 - focusX * zoom,
    viewport.clientHeight / 2 - focusY * zoom
  );
}

document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    const next = button.dataset.mode as Mode;
    if (next === "build") {
      buildType = "watchtower";
      setStatus("Wybierz wieżę strażniczą i wskaż miejsce na mapie.");
    }
    if (next === "move") setStatus("Wybierz oddział i wskaż jego cel.");
    setMode(next);
  });
});

document.querySelector<HTMLButtonElement>("#build-tower")?.addEventListener("click", () => {
  buildType = "watchtower";
  setMode("build");
  setStatus("Budowa wieży: wskaż miejsce na mapie. Koszt: 70 drewna i 30 kamienia.");
});
document.querySelector<HTMLButtonElement>("#zoom-in")?.addEventListener("click", () => zoomAt(zoom * 1.18));
document.querySelector<HTMLButtonElement>("#zoom-out")?.addEventListener("click", () => zoomAt(zoom / 1.18));
document.querySelector<HTMLButtonElement>("#reset-camera")?.addEventListener("click", centerCamera);
document.querySelector<HTMLButtonElement>("#pause-button")?.addEventListener("click", (event) => {
  paused = !paused;
  const button = event.currentTarget as HTMLButtonElement;
  button.innerHTML = paused ? "<span>▶</span><small>WZNÓW</small>" : "<span>Ⅱ</span><small>PAUZA</small>";
  if (paused) app.ticker.stop();
  else app.ticker.start();
  setStatus(paused ? "Symulacja zatrzymana." : "Symulacja wznowiona.");
});
document.querySelector<HTMLButtonElement>("#help-button")?.addEventListener("click", () => {
  setStatus("Sterowanie: przeciągnij prawym przyciskiem, aby przesunąć mapę; rolka myszy przybliża; V wybiera, M wydaje rozkaz ruchu, B buduje.");
});

window.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
  const key = event.key.toLowerCase();
  keysDown.add(key);
  if (key === "v") setMode("select");
  if (key === "m") setMode("move");
  if (key === "b") {
    buildType = "watchtower";
    setMode("build");
  }
  if (key === "escape") {
    buildType = null;
    setMode("select");
  }
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
});
window.addEventListener("keyup", (event) => keysDown.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => keysDown.clear());

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  zoomAt(zoom * (event.deltaY < 0 ? 1.1 : 0.91), event.clientX, event.clientY);
}, { passive: false });

app.ticker.add((ticker) => {
  if (paused) return;

  for (const entity of entities) {
    if (!entity.moveTarget) continue;
    const dx = entity.moveTarget.x - entity.x;
    const dy = entity.moveTarget.y - entity.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 3) {
      entity.x = entity.moveTarget.x;
      entity.y = entity.moveTarget.y;
      entity.moveTarget = undefined;
    } else {
      const step = Math.min(1, ticker.deltaTime * 0.035);
      entity.x += dx * step;
      entity.y += dy * step;
    }
    entity.group.position.set(entity.x, entity.y);
    if (selectedEntity === entity && selectionGlyph) {
      selectionGlyph.position.set(entity.x, entity.y);
    }
  }

  // A restrained breathing motion keeps the living world from feeling like a static terminal.
  const seconds = performance.now() / 1000;
  world.layers.actors.alpha = 0.97 + Math.sin(seconds * 1.7) * 0.025;
});

const panSpeed = 5;
function panWithKeyboard(): void {
  if (keysDown.has("a") || keysDown.has("arrowleft")) worldRoot.position.x += panSpeed;
  if (keysDown.has("d") || keysDown.has("arrowright")) worldRoot.position.x -= panSpeed;
  if (keysDown.has("w") || keysDown.has("arrowup")) worldRoot.position.y += panSpeed;
  if (keysDown.has("s") || keysDown.has("arrowdown")) worldRoot.position.y -= panSpeed;
}
app.ticker.add(() => {
  if (!paused) panWithKeyboard();
});

setMode("select");
setResources();
centerCamera();
window.addEventListener("resize", centerCamera);
setStatus("Witaj, namiestniku. Twoje ziemie czekają na rozkazy.");
