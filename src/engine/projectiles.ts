export interface ProjectilePoint { x: number; y: number; }

export interface ProjectileFlight {
  elapsed: number;
  duration: number;
}

/** Advance a visual projectile; returns normalized travel progress. */
export function advanceProjectile(flight: ProjectileFlight, deltaSeconds: number): number {
  const delta = Number.isFinite(deltaSeconds) ? Math.max(0, deltaSeconds) : 0;
  const duration = Number.isFinite(flight.duration) ? Math.max(0.001, flight.duration) : 0.001;
  flight.elapsed = Math.min(duration, Math.max(0, flight.elapsed) + delta);
  return flight.elapsed / duration;
}

/** Interpolate a projectile from its launch point to the target's current position. */
export function projectilePointAt(start: ProjectilePoint, target: ProjectilePoint, progress: number): ProjectilePoint {
  const amount = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return {
    x: start.x + (target.x - start.x) * amount,
    y: start.y + (target.y - start.y) * amount
  };
}

export function projectileDuration(distance: number, speed: number): number {
  const safeDistance = Number.isFinite(distance) ? Math.max(0, distance) : 0;
  const safeSpeed = Number.isFinite(speed) ? Math.max(1, speed) : 1;
  return Math.max(0.12, Math.min(1.2, safeDistance / safeSpeed));
}
