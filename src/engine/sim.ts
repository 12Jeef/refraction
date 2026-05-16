import type {
  Buffers,
  FullSDFOutput,
  Line,
  Ray,
  SimulationParams,
  vec2,
  vec3,
} from "../types";
import {
  CHUNK_SIZE,
  getChunk,
  meanWavelength,
  rectOutlineMoveDistance,
  transitionRay,
  wavelengthsToRGB,
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
  buffers: Buffers,
  start: vec2,
  end: vec2,
  rgb: vec3,
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
      buffers.red[y * size[0] + x] += rgb[0];
      buffers.green[y * size[0] + x] += rgb[1];
      buffers.blue[y * size[0] + x] += rgb[2];
      max = Math.max(
        max,
        buffers.red[y * size[0] + x],
        buffers.green[y * size[0] + x],
        buffers.blue[y * size[0] + x],
      );
    }
  }
  return { max, line: { start, end, rgb } };
};

export const drawRay = (
  ray: Ray,
  size: vec2,
  buffers: Buffers,
  dwavelength: number,
) => {
  return drawLine(
    size,
    buffers,
    ray.origin,
    ray.position,
    wavelengthsToRGB(ray.wavelengths, dwavelength),
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
  buffers: Buffers,
): { rays: Ray[]; max: number; lines: Line[] } => {
  const newRays: Ray[] = [];
  let max = 0;
  const lines: Line[] = [];
  for (const ray of rays) {
    if (ray.nTransitions > 10) continue;
    const glass = ray.glass;
    if (glass !== null) {
      const sdf = glass.sdf(ray.position);
      if (sdf.distance < 0.1) {
        const { max: newMax, line } = drawRay(
          ray,
          params.size,
          buffers,
          params.dwavelength,
        );
        max = Math.max(max, newMax);
        lines.push(line);
        newRays.push(
          ...transitionRay(ray, { ...sdf, glass: null }, params.dwavelength),
        );
        continue;
      }
      moveRay(ray, sdf.distance);
      if (!validRay(ray, params.size)) {
        const { max: newMax, line } = drawRay(
          ray,
          params.size,
          buffers,
          params.dwavelength,
        );
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
        const { max: newMax, line } = drawRay(
          ray,
          params.size,
          buffers,
          params.dwavelength,
        );
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
      const { max: newMax, line } = drawRay(
        ray,
        params.size,
        buffers,
        params.dwavelength,
      );
      max = Math.max(max, newMax);
      lines.push(line);
      newRays.push(...transitionRay(ray, sdf, params.dwavelength));
      continue;
    }
    moveRay(ray, sdf.distance);
    if (!validRay(ray, params.size)) {
      const { max: newMax, line } = drawRay(
        ray,
        params.size,
        buffers,
        params.dwavelength,
      );
      max = Math.max(max, newMax);
      lines.push(line);
      continue;
    }
    newRays.push(ray);
  }
  return { rays: newRays, max, lines };
};

const bufferCache = new Map<string, Float32Array>();
const allocBuffer = (size: vec2, type: string): Float32Array => {
  const key = size.join(",") + "," + type;
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
  const bufferRed = allocBuffer(params.size, "red");
  const bufferGreen = allocBuffer(params.size, "green");
  const bufferBlue = allocBuffer(params.size, "blue");
  bufferRed.fill(0);
  bufferGreen.fill(0);
  bufferBlue.fill(0);
  const buffers: Buffers = {
    red: bufferRed,
    green: bufferGreen,
    blue: bufferBlue,
  };
  let max = 0;
  const lines: Line[] = [];
  while (rays.length > 0) {
    const {
      rays: newRays,
      max: newMax,
      lines: newLines,
    } = stepRays(glassSet, rays, params, buffers);
    rays = newRays;
    max = Math.max(max, newMax);
    lines.push(...newLines);
  }
  const data = ctx.createImageData(params.size[0], params.size[1]);
  for (let i = 0; i < params.size[0] * params.size[1]; i++) {
    data.data[i * 4] = Math.min(255, (buffers.red[i] / (max * 2.5e-2)) * 255);
    data.data[i * 4 + 1] = Math.min(
      255,
      (buffers.green[i] / (max * 2.5e-2)) * 255,
    );
    data.data[i * 4 + 2] = Math.min(
      255,
      (buffers.blue[i] / (max * 2.5e-2)) * 255,
    );
    data.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
};
