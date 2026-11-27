import { Application, Container, Text } from "pixi.js";
import "./style.css";
import { addGlyph } from "./engine/glyph";
import { createWatchtower, createWorld, WORLD_SIZE, type GameEntity } from "./engine/world";
import { advanceSimulation, createSimulation, setGameSpeed } from "./engine/simulation";
import { findGridPath, isBuildableAtWorld, rotateOffset, worldPositionForCell, worldToCell } from "./engine/grid";

type ToolMode = "select" | "attack-move" | "build";
type PointerSession = {
  pointerId: number;
  kind: "select" | "pan";
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  additive: boolean;
  toggle: boolean;
};

const viewport = document.querySelector<HTMLDivElement>("#map-viewport")!;
const statusMessage = document.querySelector<HTMLElement>("#status-message")!;
const zoomLabel = document.querySelector<HTMLElement>("#zoom-label")!;
const modeLabel = document.querySelector<HTMLElement>("#mode-label")!;
const mapHint = document.querySelector<HTMLElement>("#map-hint")!;
const selectedCountLabel = document.querySelector<HTMLElement>("#selected-count")!;
const selectionContent = document.querySelector<HTMLElement>("#selection-content")!;
const selectionRect = document.querySelector<HTMLDivElement>("#selection-rect")!;
const inspector = document.querySelector<HTMLElement>(".inspector")!;

if (!viewport || !statusMessage || !zoomLabel || !modeLabel || !mapHint ||
    !selectedCountLabel || !selectionContent || !selectionRect || !inspector) {
  throw new Error("DOMINIUM game interface is incomplete.");
}

const goldValue = document.querySelector<HTMLElement>("#gold-value");
const foodValue = document.querySelector<HTMLElement>("#food-value");
const woodValue = document.querySelector<HTMLElement>("#wood-value");
const stoneValue = document.querySelector<HTMLElement>("#stone-value");

const app = new Application();
await app.init({
  background: "#000000",
  resizeTo: viewport,
  antialias: true,
  autoDensity: true,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  preference: "webgl"
});

const canvas = app.canvas;
canvas.setAttribute("aria-label", "Mapa świata DOMINIUM");
canvas.style.position = "absolute";
canvas.style.inset = "0";
canvas.style.width = "100%";
canvas.style.height = "100%";
canvas.style.zIndex = "0";
viewport.prepend(canvas);

const worldRoot = new Container();
worldRoot.sortableChildren = true;
app.stage.addChild(worldRoot);
const world = createWorld(worldRoot);
const entities = world.entities;

let zoom = 0.62;
let mapRotation = 0;
let mode: ToolMode = "select";
let paused = false;
const simulation = createSimulation();
let gold = simulation.gold;
let food = simulation.food;
let wood = simulation.wood;
let stone = simulation.stone;
let towerCounter = 0;
let pointerSession: PointerSession | null = null;
let lastClick: { id: string; at: number } | null = null;
const selectedIds = new Set<string>();
const selectionMarkers = new Map<string, Text>();
const controlGroups = new Map<number, string[]>();
const keysDown = new Set<string>();

function setStatus(message: string): void {
  statusMessage.textContent = message;
}

function allSelected(): GameEntity[] {
  return entities.filter((entity) => selectedIds.has(entity.id));
}

function selectedUnits(): GameEntity[] {
  return allSelected().filter((entity) => entity.kind === "unit" && entity.team === "player");
}

function setMode(next: ToolMode): void {
  if (paused && next !== "select") { setStatus("Gra jest wstrzymana — nie można rozpoczynać budowania ani wydawać rozkazów."); next = "select"; }
  mode = next;
  document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });

  const labels: Record<ToolMode, string> = {
    select: "ZAZNACZANIE",
    "attack-move": "ATAK W RUCHU",
    build: "BUDOWANIE"
  };
  const hints: Record<ToolMode, string> = {
    select: "PRZECIĄGNIJ MYSZĄ, ABY ZAZNACZYĆ ODDZIAŁY",
    "attack-move": "WSKAŻ CEL ATAKU NA MAPIE",
    build: "WSKAŻ MIEJSCE POD WIEŻĘ STRAŻNICZĄ"
  };
  modeLabel.textContent = labels[mode] ?? labels.select;
  mapHint.textContent = hints[mode] ?? hints.select;
  canvas.style.cursor = mode === "select" ? "default" : mode === "attack-move" ? "crosshair" : "copy";
}

function setResources(): void {
  gold = simulation.gold; food = simulation.food; wood = simulation.wood; stone = simulation.stone;
  if (goldValue) goldValue.textContent = gold.toLocaleString("pl-PL");
  if (foodValue) foodValue.textContent = food.toLocaleString("pl-PL");
  if (woodValue) woodValue.textContent = wood.toLocaleString("pl-PL");
  if (stoneValue) stoneValue.textContent = stone.toLocaleString("pl-PL");
}

function redrawSelectionMarkers(): void {
  for (const marker of selectionMarkers.values()) marker.destroy();
  selectionMarkers.clear();
  world.layers.effects.removeChildren();

  for (const entity of allSelected()) {
    const marker = addGlyph(world.layers.effects, {
      char: entity.kind === "unit" ? "◎" : "⌜",
      x: entity.x,
      y: entity.y,
      size: entity.kind === "unit" ? 43 : 102,
      color: entity.team === "enemy" ? "#ff625d" : "#71caff",
      alpha: 0.94,
      weight: "bold",
      stroke: "#000000",
      strokeWidth: 2
    });
    selectionMarkers.set(entity.id, marker);
  }
}

function renderSelectionPanel(): void {
  const selection = allSelected();
  const units = selection.filter((entity) => entity.kind === "unit");
  const buildings = selection.filter((entity) => entity.kind === "building");
  selectedCountLabel.textContent = String(selection.length);

  if (selection.length === 0) {
    selectionContent.innerHTML = `
      <div class="empty-selection">
        <span class="empty-glyph">⌖</span>
        <b>Nic nie zaznaczono</b>
        <p>Przeciągnij lewym przyciskiem myszy po mapie, aby zaznaczyć wiele własnych oddziałów. Pojedyncze budynki wybierzesz kliknięciem.</p>
      </div>`;
    return;
  }

  if (selection.length > 1) {
    const totalSoldiers = units.reduce((sum, unit) => sum + (unit.count ?? 1), 0);
    const types = [...new Set(units.map((unit) => unit.unitClass ?? unit.role))];
    const health = Math.round(selection.reduce((sum, entity) => sum + entity.health, 0) / selection.length);
    selectionContent.innerHTML = `
      <div class="group-selection">
        <div class="selection-topline"><span>GRUPA BOJOWA</span><strong>${selection.length} OBIEKTY</strong></div>
        <h2>Wybrane oddziały</h2>
        <p>${units.length} oddziały · ${totalSoldiers} żołnierzy${buildings.length ? ` · ${buildings.length} budynki` : ""}</p>
        <div class="selection-health"><span style="width:${health}%"></span></div>
        <div class="selection-meta"><span>ŚREDNI STAN</span><b>${health}%</b></div>
        <div class="unit-type-list">${types.map((type) => `<span>${type}</span>`).join("")}</div>
        <div class="selection-actions">
          <button type="button" data-command="stop">■ STOP</button>
          <button type="button" data-command="hold">▣ OBRONA</button>
          <button type="button" data-command="attack-move">⚔ ATAK</button>
        </div>
      </div>`;
  } else {
    const entity = selection[0]!;
    const health = Math.max(0, Math.min(100, entity.health));
    selectionContent.innerHTML = `
      <div class="single-selection">
        <div class="selection-topline"><span>${entity.team === "enemy" ? "WROGI OBIEKT" : entity.kind === "unit" ? "ODDZIAŁ BOJOWY" : "BUDOWLA"}</span><strong>${entity.role}</strong></div>
        <h2>${entity.name}</h2>
        <p>${entity.description}</p>
        <div class="selection-health"><span style="width:${health}%;background:${entity.team === "enemy" ? "#e45b52" : "#78b8dd"}"></span></div>
        <div class="selection-meta"><span>WYTRZYMAŁOŚĆ</span><b>${Math.ceil(health)}%</b></div>
        ${entity.kind === "unit" ? `<div class="selection-meta"><span>LICZEBNOŚĆ</span><b>${entity.count ?? 1}</b></div>` : ""}
        ${entity.kind === "unit" && entity.team === "player" ? `
          <div class="selection-actions">
            <button type="button" data-command="stop">■ STOP</button>
            <button type="button" data-command="hold">▣ OBRONA</button>
            <button type="button" data-command="attack-move">⚔ ATAK</button>
          </div>` : ""}
      </div>`;
  }

  selectionContent.querySelectorAll<HTMLButtonElement>("[data-command]").forEach((button) => {
    button.addEventListener("click", () => runSelectionCommand(button.dataset.command ?? ""));
  });
}

function updateSelection(): void {
  redrawSelectionMarkers();
  renderSelectionPanel();
  inspector.classList.toggle("has-selection", selectedIds.size > 0);
}

function replaceSelection(items: GameEntity[]): void {
  selectedIds.clear();
  for (const entity of items) selectedIds.add(entity.id);
  updateSelection();
}

function clearSelection(): void {
  selectedIds.clear();
  updateSelection();
}

function toggleSelection(entity: GameEntity): void {
  if (selectedIds.has(entity.id)) selectedIds.delete(entity.id);
  else selectedIds.add(entity.id);
  updateSelection();
}

function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const offset = rotateOffset({
    x: (screenX - rect.left - worldRoot.position.x) / zoom,
    y: (screenY - rect.top - worldRoot.position.y) / zoom
  }, -mapRotation);
  return { x: 1190 + offset.x, y: 915 + offset.y };
}

function findEntityAt(x: number, y: number): GameEntity | null {
  let nearest: GameEntity | null = null;
  let nearestDistance = Infinity;
  for (const entity of entities) {
    if (entity.health <= 0) continue;
    const distance = Math.hypot(entity.x - x, entity.y - y);
    const radius = entity.kind === "building" ? 76 : 43;
    if (distance <= radius && distance < nearestDistance) {
      nearest = entity;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function visibleWorldBounds(): { left: number; top: number; right: number; bottom: number } {
  const rect = viewport.getBoundingClientRect();
  const corners = [
    screenToWorld(rect.left, rect.top),
    screenToWorld(rect.right, rect.top),
    screenToWorld(rect.left, rect.bottom),
    screenToWorld(rect.right, rect.bottom)
  ];
  return {
    left: Math.min(...corners.map((point) => point.x)),
    top: Math.min(...corners.map((point) => point.y)),
    right: Math.max(...corners.map((point) => point.x)),
    bottom: Math.max(...corners.map((point) => point.y))
  };
}

function selectBox(rect: { left: number; top: number; right: number; bottom: number }, additive: boolean, toggle: boolean): void {
  const box = {
    left: Math.min(rect.left, rect.right),
    right: Math.max(rect.left, rect.right),
    top: Math.min(rect.top, rect.bottom),
    bottom: Math.max(rect.top, rect.bottom)
  };
  const hits = entities.filter((entity) =>
    entity.kind === "unit" &&
    entity.team === "player" &&
    entity.health > 0 &&
    entity.x >= box.left && entity.x <= box.right &&
    entity.y >= box.top && entity.y <= box.bottom
  );

  if (!additive && !toggle) selectedIds.clear();
  for (const entity of hits) {
    if (toggle && selectedIds.has(entity.id)) selectedIds.delete(entity.id);
    else selectedIds.add(entity.id);
  }
  updateSelection();
  setStatus(hits.length
    ? `Zaznaczono ${hits.length} oddziałów. Kliknij prawym przyciskiem, aby wydać rozkaz.`
    : additive || toggle ? "Nie znaleziono kolejnych oddziałów w zaznaczonym obszarze." : "Pusty obszar — zaznaczenie wyczyszczone.");
}

function selectClickedEntity(entity: GameEntity, additive: boolean, toggle: boolean): void {
  if (toggle) {
    toggleSelection(entity);
  } else if (additive) {
    selectedIds.add(entity.id);
    updateSelection();
  } else {
    replaceSelection([entity]);
  }

  if (entity.kind === "unit" && entity.team === "player") {
    const now = performance.now();
    if (lastClick?.id === entity.id && now - lastClick.at < 360) {
      const bounds = visibleWorldBounds();
      const sameType = entities.filter((candidate) =>
        candidate.kind === "unit" &&
        candidate.team === "player" &&
        candidate.unitClass === entity.unitClass &&
        candidate.x >= bounds.left && candidate.x <= bounds.right &&
        candidate.y >= bounds.top && candidate.y <= bounds.bottom
      );
      replaceSelection(sameType);
      setStatus(`Wybrano wszystkie widoczne oddziały typu: ${entity.unitClass ?? entity.name}.`);
      lastClick = null;
      return;
    }
    lastClick = { id: entity.id, at: now };
  } else {
    lastClick = null;
  }
  setStatus(`Wybrano: ${entity.name}.`);
}

function setMoveOrder(unit: GameEntity, x: number, y: number, queued: boolean): boolean {
  unit.attackTargetId = undefined;
  unit.attackMoveTarget = undefined;
  unit.holdPosition = false;
  const destination = {
    x: Math.max(28, Math.min(WORLD_SIZE.width - 28, x)),
    y: Math.max(28, Math.min(WORLD_SIZE.height - 28, y))
  };
  const lastQueuedPoint = unit.movementQueue?.[unit.movementQueue.length - 1];
  const routeStart = queued ? lastQueuedPoint ?? unit.moveTarget ?? unit : unit;
  const route = findGridPath(world.grid, routeStart, destination);
  if (!route) {
    if (!queued) {
      unit.moveTarget = undefined;
      unit.movementQueue = [];
    }
    return false;
  }
  if (route.length === 0) route.push(destination);
  if (queued) {
    unit.movementQueue ??= [];
    unit.movementQueue.push(...route);
    if (!unit.moveTarget) unit.moveTarget = unit.movementQueue.shift();
  } else {
    unit.movementQueue = route.slice(1);
    unit.moveTarget = route[0];
  }
  return true;
}

function issueFormationOrder(x: number, y: number, queued: boolean): void {
  if (paused) { setStatus("Gra jest wstrzymana — wznów symulację, aby wydawać rozkazy."); return; }
  const units = selectedUnits();
  if (units.length === 0) {
    setStatus("Najpierw zaznacz własne oddziały.");
    return;
  }

  const columns = Math.ceil(Math.sqrt(units.length));
  const rows = Math.ceil(units.length / columns);
  const spacing = units.length > 12 ? 66 : 54;
  let routed = 0;
  units.forEach((unit, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const offsetX = (column - (columns - 1) / 2) * spacing;
    const offsetY = (row - (rows - 1) / 2) * spacing;
    if (setMoveOrder(unit, x + offsetX, y + offsetY, queued)) routed += 1;
  });
  setStatus(routed === units.length
    ? queued
      ? "Dodano trasę do kolejki dla " + routed + " oddziałów."
      : "Rozkaz marszu: " + routed + " oddziałów rusza wyznaczoną trasą."
    : "Trasę wyznaczono dla " + routed + "/" + units.length + " oddziałów. Woda lub klify blokują przejście.");
}

function issueAttackOrder(target: GameEntity): void {
  if (paused) { setStatus("Gra jest wstrzymana — wznów symulację, aby wydawać rozkazy."); return; }
  const units = selectedUnits();
  if (units.length === 0) {
    setStatus("Zaznacz własne oddziały, aby wydać rozkaz ataku.");
    return;
  }
  for (const unit of units) {
    unit.attackTargetId = target.id;
    unit.attackMoveTarget = undefined;
    unit.moveTarget = undefined;
    unit.movementQueue = [];
    unit.holdPosition = false;
  }
  setStatus(`Rozkaz ataku: ${units.length} oddziałów atakuje ${target.name}.`);
}

function issueAttackMove(x: number, y: number): void {
  if (paused) { setStatus("Gra jest wstrzymana — wznów symulację, aby wydawać rozkazy."); setMode("select"); return; }
  const units = selectedUnits();
  if (units.length === 0) {
    setStatus("Najpierw zaznacz własne oddziały.");
    setMode("select");
    return;
  }
  const columns = Math.ceil(Math.sqrt(units.length));
  const rows = Math.ceil(units.length / columns);
  let routed = 0;
  units.forEach((unit, index) => {
    const offsetX = (index % columns - (columns - 1) / 2) * 54;
    const offsetY = (Math.floor(index / columns) - (rows - 1) / 2) * 54;
    const destination = { x: x + offsetX, y: y + offsetY };
    const route = findGridPath(world.grid, unit, destination);
    unit.attackTargetId = undefined;
    unit.holdPosition = false;
    unit.movementQueue = route ? route.slice(1) : [];
    unit.attackMoveTarget = route ? destination : undefined;
    unit.moveTarget = route ? route[0] ?? destination : undefined;
    if (route) routed += 1;
  });
  setStatus(routed === units.length
    ? "Oddziały ruszają wyznaczoną trasą z rozkazem ataku w ruchu."
    : "Trasę ataku wyznaczono dla " + routed + "/" + units.length + " oddziałów.");
  setMode("select");
}

function stopUnits(): void {
  if (paused) { setStatus("Gra jest wstrzymana — rozkazy są niedostępne."); return; }
  for (const unit of selectedUnits()) {
    unit.moveTarget = undefined;
    unit.attackMoveTarget = undefined;
    unit.attackTargetId = undefined;
    unit.movementQueue = [];
    unit.holdPosition = false;
  }
  setStatus("Rozkaz STOP: oddziały zatrzymały się.");
}

function holdUnits(): void {
  if (paused) { setStatus("Gra jest wstrzymana — rozkazy są niedostępne."); return; }
  for (const unit of selectedUnits()) {
    unit.moveTarget = undefined;
    unit.attackMoveTarget = undefined;
    unit.attackTargetId = undefined;
    unit.movementQueue = [];
    unit.holdPosition = true;
  }
  setStatus("Rozkaz OBRONA: oddziały utrzymują pozycję.");
}

function runSelectionCommand(command: string): void {
  if (command === "stop") stopUnits();
  else if (command === "hold") holdUnits();
  else if (command === "attack-move") setMode("attack-move");
}

function handleContextCommand(clientX: number, clientY: number, queued: boolean): void {
  const point = screenToWorld(clientX, clientY);
  const target = findEntityAt(point.x, point.y);
  if (target?.team === "enemy") {
    issueAttackOrder(target);
    return;
  }
  issueFormationOrder(point.x, point.y, queued);
}

function placeWatchtower(x: number, y: number): void {
  if (paused) { setStatus("Gra jest wstrzymana — budowanie jest niedostępne."); return; }
  if (wood < 70 || stone < 30) {
    setStatus("Brakuje surowców: wieża wymaga 70 drewna i 30 kamienia.");
    return;
  }
  if (x < 40 || y < 40 || x > WORLD_SIZE.width - 40 || y > WORLD_SIZE.height - 40) {
    setStatus("Nie można budować poza granicami mapy.");
    return;
  }
  const buildTile = worldToCell(world.grid, { x, y });
  const buildPoint = buildTile ? worldPositionForCell(world.grid, buildTile.col, buildTile.row) : null;
  if (!buildPoint || !isBuildableAtWorld(world.grid, buildPoint)) {
    setStatus("Teren jest niedostępny pod budowę. Woda, las, klify i złoża mają własne zasady zabudowy.");
    return;
  }
  if (entities.some((entity) => Math.hypot(entity.x - buildPoint.x, entity.y - buildPoint.y) < (entity.kind === "building" ? 112 : 48))) {
    setStatus("To miejsce jest zajęte. Wybierz wolny teren.");
    return;
  }

  simulation.wood -= 70;
  simulation.stone -= 30;
  towerCounter += 1;
  const tower = createWatchtower(world.layers.structures, buildPoint.x, buildPoint.y, towerCounter);
  entities.push(tower);
  setResources();
  replaceSelection([tower]);
  setMode("select");
  setStatus("Wieża strażnicza wzniesiona.");
}

function handleLeftClick(clientX: number, clientY: number, additive: boolean, toggle: boolean): void {
  if (paused && mode !== "select") { setStatus("Gra jest wstrzymana — wznowienie odblokuje budowanie i rozkazy."); return; }
  const point = screenToWorld(clientX, clientY);
  if (mode === "build") {
    placeWatchtower(point.x, point.y);
    return;
  }
  if (mode === "attack-move") {
    issueAttackMove(point.x, point.y);
    return;
  }
  const entity = findEntityAt(point.x, point.y);
  if (entity) {
    selectClickedEntity(entity, additive, toggle);
  } else if (!additive && !toggle) {
    clearSelection();
    setStatus("Zaznaczenie wyczyszczone.");
  }
}

function updateSelectionRectangle(clientX: number, clientY: number): void {
  if (!pointerSession) return;
  const bounds = viewport.getBoundingClientRect();
  const left = Math.min(pointerSession.startX, clientX);
  const top = Math.min(pointerSession.startY, clientY);
  const right = Math.max(pointerSession.startX, clientX);
  const bottom = Math.max(pointerSession.startY, clientY);
  selectionRect.style.display = "block";
  selectionRect.style.left = `${left - bounds.left}px`;
  selectionRect.style.top = `${top - bounds.top}px`;
  selectionRect.style.width = `${right - left}px`;
  selectionRect.style.height = `${bottom - top}px`;
}

function hideSelectionRectangle(): void {
  selectionRect.style.display = "none";
}

canvas.addEventListener("pointerdown", (event: PointerEvent) => {
  if (event.button === 2) {
    event.preventDefault();
    return;
  }
  if (event.button !== 0 && event.button !== 1) return;

  const pan = event.button === 1 || (event.button === 0 && keysDown.has(" "));
  pointerSession = {
    pointerId: event.pointerId,
    kind: pan ? "pan" : "select",
    startX: event.clientX,
    startY: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    moved: false,
    additive: event.shiftKey,
    toggle: event.ctrlKey || event.metaKey
  };
  canvas.setPointerCapture(event.pointerId);
  if (pan) canvas.style.cursor = "grabbing";
  event.preventDefault();
});

canvas.addEventListener("pointermove", (event: PointerEvent) => {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId) return;
  const dx = event.clientX - pointerSession.lastX;
  const dy = event.clientY - pointerSession.lastY;
  const totalDistance = Math.hypot(event.clientX - pointerSession.startX, event.clientY - pointerSession.startY);

  if (pointerSession.kind === "pan") {
    worldRoot.position.x += dx;
    worldRoot.position.y += dy;
    pointerSession.moved = totalDistance > 2;
  } else if (mode === "select" && totalDistance > 5) {
    pointerSession.moved = true;
    updateSelectionRectangle(event.clientX, event.clientY);
  }
  pointerSession.lastX = event.clientX;
  pointerSession.lastY = event.clientY;
});

function finishPointer(event: PointerEvent): void {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId) return;
  const session = pointerSession;
  pointerSession = null;
  hideSelectionRectangle();

  if (session.kind === "pan") {
    canvas.style.cursor = mode === "select" ? "default" : mode === "attack-move" ? "crosshair" : "copy";
    return;
  }
  if (session.moved && mode === "select") {
    const start = screenToWorld(session.startX, session.startY);
    const end = screenToWorld(event.clientX, event.clientY);
    selectBox(
      { left: start.x, top: start.y, right: end.x, bottom: end.y },
      session.additive,
      session.toggle
    );
  } else {
    handleLeftClick(event.clientX, event.clientY, session.additive, session.toggle);
  }
}
canvas.addEventListener("pointerup", finishPointer);
canvas.addEventListener("pointercancel", finishPointer);
canvas.addEventListener("pointerup", (event: PointerEvent) => {
  if (event.button === 2) handleContextCommand(event.clientX, event.clientY, event.shiftKey);
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());

function zoomAt(nextZoom: number, clientX?: number, clientY?: number): void {
  const clamped = Math.max(0.28, Math.min(1.7, nextZoom));
  if (Math.abs(clamped - zoom) < 0.001) return;
  const rect = canvas.getBoundingClientRect();
  const px = clientX === undefined ? rect.width / 2 : clientX - rect.left;
  const py = clientY === undefined ? rect.height / 2 : clientY - rect.top;
  const focus = screenToWorld(
    clientX === undefined ? rect.left + px : clientX,
    clientY === undefined ? rect.top + py : clientY
  );
  const offset = rotateOffset({ x: (focus.x - 1190) * clamped, y: (focus.y - 915) * clamped }, mapRotation);
  zoom = clamped;
  worldRoot.scale.set(zoom);
  worldRoot.position.set(px - offset.x, py - offset.y);
  zoomLabel.textContent = String(Math.round(zoom * 100)) + "%";
}

function centerCamera(): void {
  zoom = 0.62;
  worldRoot.pivot.set(1190, 915);
  worldRoot.rotation = mapRotation * Math.PI / 2;
  worldRoot.scale.set(zoom);
  worldRoot.position.set(viewport.clientWidth / 2, viewport.clientHeight / 2);
  zoomLabel.textContent = String(Math.round(zoom * 100)) + "%";
}

function rotateMap(direction: 1 | -1): void {
  mapRotation = (mapRotation + direction + 4) % 4;
  worldRoot.rotation = mapRotation * Math.PI / 2;
  const label = document.querySelector<HTMLElement>("#rotation-label");
  if (label) label.textContent = String(mapRotation * 90) + "°";
  setStatus("Obrót mapy: " + (mapRotation * 90) + "°. Siatka i teren pozostają wyrównane z obiektami.");
}

function saveControlGroup(number: number): void {
  const units = selectedUnits();
  if (units.length === 0) return;
  controlGroups.set(number, units.map((unit) => unit.id));
  setStatus(`Zapisano grupę ${number}: ${units.length} oddziałów. Użyj klawisza ${number}, aby ją wybrać.`);
}

function selectControlGroup(number: number): void {
  const ids = controlGroups.get(number);
  if (!ids) return;
  const group = entities.filter((entity) => ids.includes(entity.id) && entity.health > 0);
  replaceSelection(group);
  setStatus(`Wybrano grupę ${number}: ${group.length} obiektów.`);
}

document.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    const nextMode = button.dataset.mode as ToolMode;
    if (nextMode === "build") setStatus("Wybierz miejsce pod wieżę strażniczą.");
    if (nextMode === "attack-move") setStatus("Wskaż cel. Oddziały zaatakują napotkanych wrogów po drodze.");
    setMode(nextMode);
  });
});

document.querySelector<HTMLButtonElement>("#build-tower")?.addEventListener("click", () => {
  setMode("build");
  setStatus("Budowa wieży: kliknij wolne miejsce na mapie. Koszt: 70 drewna i 30 kamienia.");
});
document.querySelector<HTMLButtonElement>("#zoom-in")?.addEventListener("click", () => zoomAt(zoom * 1.18));
document.querySelector<HTMLButtonElement>("#zoom-out")?.addEventListener("click", () => zoomAt(zoom / 1.18));
document.querySelector<HTMLButtonElement>("#reset-camera")?.addEventListener("click", centerCamera);
function togglePause(): void {
  paused = !paused;
  const button = document.querySelector<HTMLButtonElement>("#pause-button");
  if (button) {
    button.innerHTML = paused ? "<span>▶</span><small>WZNÓW</small>" : "<span>Ⅱ</span><small>PAUZA</small>";
    button.classList.toggle("paused", paused);
  }
  if (paused) setMode("select");
  setStatus(paused ? "Symulacja zatrzymana." : "Symulacja wznowiona.");
}
document.querySelector<HTMLButtonElement>("#pause-button")?.addEventListener("click", togglePause);
document.querySelector<HTMLSelectElement>("#ration-select")?.addEventListener("change", (event) => {
  const value = Number((event.currentTarget as HTMLSelectElement).value);
  if ([0, 0.5, 1, 1.5, 2].includes(value)) {
    simulation.ration = value as 0 | 0.5 | 1 | 1.5 | 2;
    setStatus("Zmieniono poziom racji. Nowe zużycie i wpływ na popularność zostaną rozliczone w kolejnym miesiącu.");
  }
});
document.querySelector<HTMLSelectElement>("#tax-select")?.addEventListener("change", (event) => {
  simulation.tax = (event.currentTarget as HTMLSelectElement).value as typeof simulation.tax;
  setStatus("Zmieniono politykę podatkową. Bilans zostanie rozliczony w kolejnym miesiącu.");
});

function updateSpeedLabel(): void {
  const label = document.querySelector<HTMLElement>("#speed-value");
  if (label) label.textContent = String(simulation.speed);
}
document.querySelector<HTMLButtonElement>("#speed-down")?.addEventListener("click", () => {
  setGameSpeed(simulation, simulation.speed - 5); updateSpeedLabel();
  setStatus(`Prędkość symulacji: ${simulation.speed}.`);
});
document.querySelector<HTMLButtonElement>("#speed-up")?.addEventListener("click", () => {
  setGameSpeed(simulation, simulation.speed + 5); updateSpeedLabel();
  setStatus(`Prędkość symulacji: ${simulation.speed}.`);
});

document.querySelector<HTMLButtonElement>("#help-button")?.addEventListener("click", () => {
  setStatus("LPM: zaznacz / przeciągnij prostokąt. Shift: dodaj, Ctrl: przełącz. PPM: ruch lub atak. Środkowy przycisk: przesuwanie mapy. X/C: obrót mapy o 90°. A: atak w ruchu, S: stop, H: obrona, Ctrl+1–9: grupy.");
});

document.querySelectorAll<HTMLButtonElement>("[data-command-global]").forEach((button) => {
  button.addEventListener("click", () => {
    const command = button.dataset.commandGlobal ?? "";
    if (command === "stop") stopUnits();
    else if (command === "hold") holdUnits();
    else if (command === "attack-move") setMode("attack-move");
  });
});

window.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
  const key = event.key.toLowerCase();
  if (event.ctrlKey && /^[1-9]$/.test(event.key)) {
    saveControlGroup(Number(event.key));
    event.preventDefault();
    return;
  }
  if (!event.ctrlKey && !event.metaKey && /^[1-9]$/.test(event.key)) {
    selectControlGroup(Number(event.key));
    return;
  }
  keysDown.add(key);
  if (key === "a") setMode("attack-move");
  if (key === "s") stopUnits();
  if (key === "h") holdUnits();
  if (key === "b" && !paused) setMode("build");
  if (key === "p") togglePause();
  if (key === "x") rotateMap(1);
  if (key === "c") rotateMap(-1);
  if (key === "+" || key === "=") { setGameSpeed(simulation, simulation.speed + 5); updateSpeedLabel(); }
  if (key === "-") { setGameSpeed(simulation, simulation.speed - 5); updateSpeedLabel(); }
  if (key === "escape") setMode("select");

  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
});
window.addEventListener("keyup", (event) => keysDown.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => keysDown.clear());

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  zoomAt(zoom * (event.deltaY < 0 ? 1.1 : 0.91), event.clientX, event.clientY);
}, { passive: false });

function findTarget(id: string | undefined): GameEntity | undefined {
  return id ? entities.find((entity) => entity.id === id && entity.health > 0) : undefined;
}

function moveUnit(unit: GameEntity, deltaSeconds: number): void {
  if (!unit.moveTarget) return;
  const dx = unit.moveTarget.x - unit.x;
  const dy = unit.moveTarget.y - unit.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 3) {
    unit.x = unit.moveTarget.x;
    unit.y = unit.moveTarget.y;
    unit.moveTarget = unit.movementQueue?.shift();
    if (!unit.moveTarget && unit.attackMoveTarget) {
      unit.attackMoveTarget = undefined;
    }
  } else {
    const speed = unit.moveSpeed ?? 92;
    const step = Math.min(distance, speed * deltaSeconds);
    unit.x += (dx / distance) * step;
    unit.y += (dy / distance) * step;
    unit.group.rotation = Math.atan2(dy, dx) * 0.08;
  }
  unit.group.position.set(unit.x, unit.y);
  const marker = selectionMarkers.get(unit.id);
  if (marker) marker.position.set(unit.x, unit.y);
}

function updateCombat(deltaSeconds: number): void {
  const defeated: GameEntity[] = [];
  for (const unit of entities) {
    if (unit.kind !== "unit" || unit.holdPosition) continue;

    if (unit.attackMoveTarget && !unit.attackTargetId) {
      const nearestEnemy = entities
        .filter((candidate) => candidate.team !== unit.team && candidate.health > 0)
        .map((candidate) => ({ candidate, distance: Math.hypot(candidate.x - unit.x, candidate.y - unit.y) }))
        .filter((entry) => entry.distance < 180)
        .sort((a, b) => a.distance - b.distance)[0]?.candidate;
      if (nearestEnemy) {
        unit.attackTargetId = nearestEnemy.id;
        unit.moveTarget = undefined;
      }
    }

    const target = findTarget(unit.attackTargetId);
    if (!target) {
      unit.attackTargetId = undefined;
      continue;
    }

    const dx = target.x - unit.x;
    const dy = target.y - unit.y;
    const distance = Math.hypot(dx, dy);
    const range = unit.attackRange ?? 52;
    if (distance > range) {
      unit.moveTarget = {
        x: target.x - (dx / Math.max(distance, 1)) * (range * 0.65),
        y: target.y - (dy / Math.max(distance, 1)) * (range * 0.65)
      };
    } else {
      unit.moveTarget = undefined;
      unit.attackCooldown = Math.max(0, (unit.attackCooldown ?? 0) - deltaSeconds);
      if (unit.attackCooldown === 0) {
        target.health -= unit.attackDamage ?? 9;
        unit.attackCooldown = 0.85;
        if (target.health <= 0) defeated.push(target);
      }
    }
  }

  for (const entity of new Set(defeated)) {
    const index = entities.findIndex((candidate) => candidate.id === entity.id);
    if (index >= 0) entities.splice(index, 1);
    selectedIds.delete(entity.id);
    entity.group.destroy({ children: true });
    setStatus(`${entity.name} został zniszczony.`);
  }
  if (defeated.length > 0) updateSelection();
}

function panCamera(deltaSeconds: number): void {
  const speed = 520 * deltaSeconds;
  if (keysDown.has("arrowleft")) worldRoot.position.x += speed;
  if (keysDown.has("arrowright")) worldRoot.position.x -= speed;
  if (keysDown.has("arrowup")) worldRoot.position.y += speed;
  if (keysDown.has("arrowdown")) worldRoot.position.y -= speed;
}

app.ticker.add((ticker) => {
  if (paused) return;
  const deltaSeconds = Math.min(ticker.deltaMS / 1000, 0.05);
  panCamera(deltaSeconds);
  const reports = advanceSimulation(simulation, deltaSeconds);
  if (reports.length) {
    const latest = reports[reports.length - 1]!;
    setResources();
    const monthLabel = document.querySelector<HTMLElement>("#month-value");
    const populationLabel = document.querySelector<HTMLElement>("#population-value");
    const popularityLabel = document.querySelector<HTMLElement>("#popularity-value");
    if (monthLabel) monthLabel.textContent = `M${simulation.month}`;
    if (populationLabel) populationLabel.textContent = `${simulation.population}/${simulation.housing}`;
    if (popularityLabel) { popularityLabel.textContent = String(simulation.popularity); popularityLabel.style.color = simulation.popularity >= 50 ? "#64c982" : "#f06c65"; }
    setStatus(`Rozliczenie miesiąca ${latest.month - 1}: żywność −${latest.foodConsumed.toFixed(2)}, złoto ${latest.taxes >= 0 ? "+" : ""}${latest.taxes.toFixed(1)}${latest.bribeCost ? `, łapówka −${latest.bribeCost.toFixed(1)}` : ""}, popularność ${latest.popularityChange >= 0 ? "+" : ""}${latest.popularityChange}.`);
  }
  updateCombat(deltaSeconds);
  for (const entity of entities) {
    if (entity.kind === "unit") moveUnit(entity, deltaSeconds);
  }
});

setMode("select");
setResources();
updateSpeedLabel();
centerCamera();
updateSelection();
const initialMonth = document.querySelector<HTMLElement>("#month-value");
const initialPopulation = document.querySelector<HTMLElement>("#population-value");
const initialPopularity = document.querySelector<HTMLElement>("#popularity-value");
if (initialMonth) initialMonth.textContent = `M${simulation.month}`;
if (initialPopulation) initialPopulation.textContent = `${simulation.population}/${simulation.housing}`;
if (initialPopularity) initialPopularity.textContent = String(simulation.popularity);
window.addEventListener("resize", centerCamera);
