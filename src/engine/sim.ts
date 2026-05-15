import type { FullSDFOutput, Ray, SimulationParams, vec2 } from "../types";
import {
  CHUNK_SIZE,
  getChunk,
  meanWavelength,
  rectOutlineMoveDistance,
  transitionRay,
} from "../util";
import type { GlassSet } from "./glass";
import type { Light } from "./lights";

export const createRays = (lights: Light[], density: number): Ray[] => {
  const rays: Ray[] = [];
  for (const light of lights) rays.push(...light.emit(density));
  return rays;
};

export const drawLine = (
  size: vec2,
  buffer: Float32Array,
  start: vec2,
  end: vec2,
  value: number,
): number => {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const steps = Math.ceil(Math.sqrt(dx * dx + dy * dy));
  let max = 0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = Math.floor(start[0] + t * dx);
    const y = Math.floor(start[1] + t * dy);
    if (x >= 0 && y >= 0 && x < size[0] && y < size[1]) {
      buffer[y * size[0] + x] += value;
      max = Math.max(max, buffer[y * size[0] + x]);
    }
  }
  return max;
};

export const drawAndMoveRay = (
  ray: Ray,
  distance: number,
  size: vec2,
  buffer: Float32Array,
): number => {
  const newPosition: vec2 = [
    ray.position[0] + ray.angle[0] * distance,
    ray.position[1] + ray.angle[1] * distance,
  ];
  const max = drawLine(
    size,
    buffer,
    ray.position,
    newPosition,
    typeof ray.wavelengths.amplitude === "function"
      ? ray.wavelengths.amplitude(meanWavelength(ray.wavelengths))
      : ray.wavelengths.amplitude,
  );
  ray.position = newPosition;
  return max;
};

export const validRay = (ray: Ray, size: vec2): boolean => {
  return (
    ray.position[0] >= 0 &&
    ray.position[1] >= 0 &&
    ray.position[0] <= size[0] &&
    ray.position[1] <= size[1]
  );
};

export const stepRays = (
  glassSet: GlassSet,
  rays: Ray[],
  params: SimulationParams,
): { rays: Ray[]; max: number } => {
  const newRays: Ray[] = [];
  let max = 0;
  for (const ray of rays) {
    const glass = ray.glass;
    if (glass !== null) {
      const sdf = glass.sdf(ray.position);
      if (sdf.distance < 0.1) {
        continue;
      }
      max = Math.max(
        max,
        drawAndMoveRay(ray, sdf.distance, params.size, params.buffer),
      );
      if (!validRay(ray, params.size)) continue;
      newRays.push(ray);
      continue;
    }
    const [chunkX, chunkY] = getChunk(ray.position);
    const glasses = glassSet.getGlassesAt([chunkX, chunkY]);
    if (glasses.length === 0) {
      const chunkMinX = chunkX * CHUNK_SIZE;
      const chunkMinY = chunkY * CHUNK_SIZE;
      const chunkMaxX = chunkMinX + CHUNK_SIZE;
      const chunkMaxY = chunkMinY + CHUNK_SIZE;
      const distance =
        rectOutlineMoveDistance(ray.position, ray.angle, [
          [chunkMinX, chunkMinY],
          [chunkMaxX, chunkMaxY],
        ]) + 1e-3;
      max = Math.max(
        max,
        drawAndMoveRay(ray, distance, params.size, params.buffer),
      );
      if (!validRay(ray, params.size)) continue;
      newRays.push(ray);
      continue;
    }
    const sdf = glasses.reduce(
      (min, glass) => {
        const sdf = glass.sdf(ray.position);
        return sdf.distance < min.distance ? sdf : min;
      },
      { distance: Infinity, normal: [0, 0], glass: null } as FullSDFOutput,
    );
    if (sdf.distance < 0.1) {
      newRays.push(...transitionRay(ray, sdf, params.dwavelength));
      continue;
    }
    drawAndMoveRay(ray, sdf.distance, params.size, params.buffer);
    if (!validRay(ray, params.size)) continue;
    newRays.push(ray);
  }
  return { rays: newRays, max };
};

export const simulateRays = (
  glassSet: GlassSet,
  rays: Ray[],
  params: SimulationParams,
) => {
  if (params.buffer.length !== params.size[0] * params.size[1])
    throw new Error("Buffer size does not match sandbox size");
  let max = 0;
  while (rays.length > 0) {
    const { rays: newRays, max: newMax } = stepRays(glassSet, rays, params);
    rays = newRays;
    max = Math.max(max, newMax);
  }
  for (let i = 0; i < params.buffer.length; i++) params.buffer[i] /= max;
};
