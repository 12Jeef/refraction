import type {
  FullSDFOutput,
  Line,
  Ray,
  SimulationParams,
  vec2,
} from "../types";
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
): { max: number; line: Line } => {
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
  return { max, line: { start, end, value } };
};

export const drawRay = (ray: Ray, size: vec2, buffer: Float32Array) => {
  return drawLine(
    size,
    buffer,
    ray.origin,
    ray.position,
    typeof ray.wavelengths.amplitude === "function"
      ? ray.wavelengths.amplitude(meanWavelength(ray.wavelengths))
      : ray.wavelengths.amplitude,
  );
};

export const moveRay = (ray: Ray, distance: number) => {
  ray.position[0] += ray.angle[0] * distance;
  ray.position[1] += ray.angle[1] * distance;
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
  buffer: Float32Array,
): { rays: Ray[]; max: number; lines: Line[] } => {
  const newRays: Ray[] = [];
  let max = 0;
  const lines: Line[] = [];
  for (const ray of rays) {
    const glass = ray.glass;
    if (glass !== null) {
      // const sdf = glass.sdf(ray.position);
      // if (sdf.distance < 0.1) {
      //   const { max: newMax, line } = drawRay(ray, params.size, buffer);
      //   max = Math.max(max, newMax);
      //   lines.push(line);
      //   continue;
      // }
      // moveRay(ray, sdf.distance);
      moveRay(ray, 1000);
      if (!validRay(ray, params.size)) {
        const { max: newMax, line } = drawRay(ray, params.size, buffer);
        max = Math.max(max, newMax);
        lines.push(line);
        continue;
      }
      newRays.push(ray);
      continue;
    }
    const [chunkX, chunkY] = getChunk(ray.position);
    const glasses = glassSet.glasses; // glassSet.getGlassesAt(chunkX, chunkY);
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
      moveRay(ray, distance);
      if (!validRay(ray, params.size)) {
        const { max: newMax, line } = drawRay(ray, params.size, buffer);
        max = Math.max(max, newMax);
        lines.push(line);
        continue;
      }
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
      const { max: newMax, line } = drawRay(ray, params.size, buffer);
      max = Math.max(max, newMax);
      lines.push(line);
      newRays.push(...transitionRay(ray, sdf, params.dwavelength));
      continue;
    }
    moveRay(ray, sdf.distance);
    if (!validRay(ray, params.size)) {
      const { max: newMax, line } = drawRay(ray, params.size, buffer);
      max = Math.max(max, newMax);
      lines.push(line);
      continue;
    }
    newRays.push(ray);
  }
  return { rays: newRays, max, lines };
};

const bufferCache = new Map<string, Float32Array>();
const allocBuffer = (size: vec2): Float32Array => {
  const key = size.join(",");
  if (!bufferCache.has(key))
    bufferCache.set(key, new Float32Array(size[0] * size[1]));
  return bufferCache.get(key)!;
};

export const simulateRays = (
  glassSet: GlassSet,
  rays: Ray[],
  params: SimulationParams,
) => {
  const { ctx } = params;
  const buffer = allocBuffer(params.size);
  buffer.fill(0);
  let max = 0;
  const lines: Line[] = [];
  while (rays.length > 0) {
    const {
      rays: newRays,
      max: newMax,
      lines: newLines,
    } = stepRays(glassSet, rays, params, buffer);
    rays = newRays;
    max = Math.max(max, newMax);
    lines.push(...newLines);
  }
  const data = ctx.createImageData(params.size[0], params.size[1]);
  for (let i = 0; i < buffer.length; i++) {
    const value = Math.min(255, (buffer[i] / (max * 1e-1)) * 255);
    data.data[i * 4] = value;
    data.data[i * 4 + 1] = value;
    data.data[i * 4 + 2] = value;
    data.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
};
