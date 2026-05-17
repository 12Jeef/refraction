import type {
  FullSDFOutput,
  Line,
  Ray,
  SimulationParams,
  vec2,
  vec3,
} from "../types";
import { lerp, transitionRay, wavelengthsToRGB } from "../util";
import type { Glass } from "./glass";
import type { Light } from "./lights";

export const createRays = (lights: Light[], density: number): Ray[] => {
  const rays: Ray[] = [];
  for (const light of lights) rays.push(...light.emit(density));
  return rays;
};

export const drawLine = (start: vec2, end: vec2, rgb: vec3): Line => {
  return { start, end, rgb };
};

export const drawRay = (ray: Ray) => {
  return drawLine(
    ray.origin,
    ray.position,
    wavelengthsToRGB(ray.wavelengths, 25),
  );
};

export const moveRay = (ray: Ray, distance: number) => {
  ray.position[0] += ray.angle[0] * distance;
  ray.position[1] += ray.angle[1] * distance;
  ray.distance += distance;
};

export const stepRays = (
  glasses: Glass[],
  rays: Ray[],
  params: SimulationParams,
): { rays: Ray[]; lines: Line[] } => {
  const newRays: Ray[] = [];
  const lines: Line[] = [];
  for (const ray of rays) {
    if (ray.distance > params.maxDistance) {
      lines.push(drawRay(ray));
      continue;
    }
    const glass = ray.glass;
    if (glass !== null) {
      const sdf = glass.sdf(ray.position);
      if (sdf.distance > -0.1) {
        lines.push(drawRay(ray));
        newRays.push(
          ...transitionRay(ray, { ...sdf, glass: null }, params.dwavelength),
        );
        continue;
      }
      moveRay(ray, -sdf.distance);
      newRays.push(ray);
      continue;
    }
    const sdf = glasses.reduce(
      (min, glass) => {
        const sdf = glass.sdf(ray.position);
        return sdf.distance < min.distance ? sdf : min;
      },
      {
        distance: params.maxDistance,
        normal: [0, 0],
        glass: null,
        internal: false,
      } as FullSDFOutput,
    );
    if (sdf.distance < 0.1) {
      lines.push(drawRay(ray));
      newRays.push(...transitionRay(ray, sdf, params.dwavelength));
      continue;
    }
    moveRay(ray, sdf.distance);
    newRays.push(ray);
  }
  return { rays: newRays, lines };
};

export const simulateRays = (
  glasses: Glass[],
  lights: Light[],
  params: SimulationParams,
) => {
  const { density, ctx } = params;
  let rays: Ray[] = [];
  for (const light of lights) rays.push(...light.emit(density));
  for (const ray of rays) {
    const sdf = glasses.reduce(
      (min, glass) => {
        const sdf = glass.sdf(ray.position);
        return sdf.distance < min.distance ? sdf : min;
      },
      {
        distance: Infinity,
        normal: [0, 0],
        glass: null,
        internal: false,
      } as FullSDFOutput,
    );
    if (sdf.distance < 0) ray.glass = sdf.glass;
  }
  const lines: Line[] = [];
  while (rays.length > 0) {
    const { rays: newRays, lines: newLines } = stepRays(glasses, rays, params);
    rays = newRays;
    lines.push(...newLines);
  }
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    for (const line of lines) {
      ctx.strokeStyle = `rgba(${255 * +(i === 0)}, ${255 * +(i === 1)}, ${255 * +(i === 2)}, ${line.rgb[i] * lerp(1e-2, 5e-2, (density - 1) / (0.5 - 1))})`;
      ctx.beginPath();
      ctx.moveTo(...line.start);
      ctx.lineTo(...line.end);
      ctx.stroke();
    }
  }
};
