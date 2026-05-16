import type {
  ChunkSpan,
  CircleGlassProps,
  ConvexGlassProps,
  FullSDFOutput,
  GlassProps,
  Material,
  PolygonGlassProps,
  SDFOutput,
  vec2,
} from "../types";
import { getChunk, lineDistance } from "../util";

export const vacuumMaterial: Material = {
  refractiveIndex: 1,
};
export const defaultMaterial: Material = {
  refractiveIndex: (length) => 1.5046 + 0.0042 / (length * length),
};
export const mirrorMaterial: Material = {
  refractiveIndex: 1e9,
};

export abstract class Glass {
  public material: Material;

  public constructor({ material }: GlassProps) {
    this.material = material ?? defaultMaterial;
  }

  public abstract chunkSpan(): ChunkSpan;
  protected abstract sdfInternal(position: [number, number]): SDFOutput;
  public sdf(position: [number, number]): FullSDFOutput {
    const sdf = this.sdfInternal(position);
    if (sdf.distance < 0) {
      sdf.distance *= -1;
      sdf.normal[0] *= -1;
      sdf.normal[1] *= -1;
    }
    return { ...sdf, glass: this };
  }
}

export class CircleGlass extends Glass {
  public center: [number, number];
  public radius: number;

  public constructor({ center, radius, ...glassProps }: CircleGlassProps) {
    super(glassProps);
    this.center = center;
    this.radius = radius;
  }

  public chunkSpan(): ChunkSpan {
    const min: vec2 = [
      this.center[0] - this.radius,
      this.center[1] - this.radius,
    ];
    const max: vec2 = [
      this.center[0] + this.radius,
      this.center[1] + this.radius,
    ];
    const chunkMin = getChunk(min);
    const chunkMax = getChunk(max);
    return {
      x: [chunkMin[0], chunkMax[0]],
      y: [chunkMin[1], chunkMax[1]],
    };
  }

  protected sdfInternal(position: vec2): SDFOutput {
    const dx = position[0] - this.center[0];
    const dy = position[1] - this.center[1];
    const distance = Math.hypot(dx, dy);
    const normal: vec2 = [dx / distance, dy / distance];
    return { distance: distance - this.radius, normal };
  }
}

export class ConvexLensGlass extends Glass {
  public center: [number, number];
  public thickness: number;
  public length: number;
  public angle: number;

  public constructor({
    center,
    thickness,
    length,
    angle,
    ...glassProps
  }: ConvexGlassProps) {
    super(glassProps);
    this.center = center;
    this.thickness = thickness;
    this.length = length;
    this.angle = angle;
  }

  public chunkSpan(): ChunkSpan {
    const dimMax = Math.max(this.thickness, this.length) / 2;
    const min: vec2 = [this.center[0] - dimMax, this.center[1] - dimMax];
    const max: vec2 = [this.center[0] + dimMax, this.center[1] + dimMax];
    const chunkMin = getChunk(min);
    const chunkMax = getChunk(max);
    return {
      x: [chunkMin[0], chunkMax[0]],
      y: [chunkMin[1], chunkMax[1]],
    };
  }

  protected sdfInternal(position: vec2): SDFOutput {
    const to: vec2 = [
      position[0] - this.center[0],
      position[1] - this.center[1],
    ];
    const toDistance = Math.hypot(to[0], to[1]);
    to[0] /= toDistance;
    to[1] /= toDistance;
    const heading: vec2 = [
      Math.cos(this.angle * (Math.PI / 180)),
      Math.sin(this.angle * (Math.PI / 180)),
    ];
    const dot = to[0] * heading[0] + to[1] * heading[1];
    // (R-t/2)^2 + (l/2)^2 = R^2
    // R^2 - Rt + t^2/4 + l^2/4 = R^2
    // t^2/4 + l^2/4 = Rt
    // t^2 + l^2 = 4Rt
    const circleRadius =
      (this.thickness ** 2 + this.length ** 2) / (4 * this.thickness);
    const circleCenter: vec2 = [
      this.center[0] -
        Math.sign(dot) * heading[0] * (circleRadius - this.thickness / 2),
      this.center[1] -
        Math.sign(dot) * heading[1] * (circleRadius - this.thickness / 2),
    ];
    const dx = position[0] - circleCenter[0];
    const dy = position[1] - circleCenter[1];
    const distance = Math.hypot(dx, dy);
    const normal: vec2 = [dx / distance, dy / distance];
    return { distance: distance - circleRadius, normal };
  }
}

export class PolygonGlass extends Glass {
  public vertices: vec2[];

  public constructor({ vertices, ...glassProps }: PolygonGlassProps) {
    super(glassProps);
    this.vertices = vertices;
  }

  public chunkSpan(): ChunkSpan {
    const xs = this.vertices.map((v) => v[0]);
    const ys = this.vertices.map((v) => v[1]);
    const min: vec2 = [Math.min(...xs), Math.min(...ys)];
    const max: vec2 = [Math.max(...xs), Math.max(...ys)];
    const chunkMin = getChunk(min);
    const chunkMax = getChunk(max);
    return {
      x: [chunkMin[0], chunkMax[0]],
      y: [chunkMin[1], chunkMax[1]],
    };
  }

  protected sdfInternal(position: vec2): SDFOutput {
    let minDistance = Infinity;
    let minNormal: vec2 = [0, 0];
    let inside = false;
    for (let i = 0; i < this.vertices.length; i++) {
      const p1 = this.vertices[i];
      const p2 = this.vertices[(i + 1) % this.vertices.length];
      const yCheck = p1[1] > position[1] !== p2[1] > position[1];
      const xIntersect =
        ((p2[0] - p1[0]) * (position[1] - p1[1])) / (p2[1] - p1[1]) + p1[0];
      if (yCheck && position[0] < xIntersect) inside = !inside;
      const distance = lineDistance(position, [p1, p2]);
      if (distance < minDistance) {
        minDistance = distance;
        const edge: vec2 = [p2[0] - p1[0], p2[1] - p1[1]];
        const edgeLength = Math.hypot(edge[0], edge[1]);
        minNormal = [edge[1] / edgeLength, -edge[0] / edgeLength];
      }
    }
    if (inside) minDistance *= -1;
    return { distance: minDistance, normal: minNormal };
  }
}

export class GlassSet {
  public glasses: Glass[];
  public lookup: Map<number, Map<number, Glass[]>>;

  public constructor(glasses: Glass[]) {
    this.glasses = glasses;
    this.lookup = new Map();
    this.computeLookup();
  }

  public computeLookup() {
    this.lookup.clear();
    for (const glass of this.glasses) {
      const { x, y } = glass.chunkSpan();
      for (let i = x[0]; i <= x[1]; i++) {
        if (!this.lookup.has(i)) this.lookup.set(i, new Map());
        const xMap = this.lookup.get(i)!;
        for (let j = y[0]; j <= y[1]; j++) {
          if (!xMap.has(j)) xMap.set(j, []);
          xMap.get(j)!.push(glass);
        }
      }
    }
  }

  public getGlassesAt(chunkX: number, chunkY: number): Glass[] {
    const glasses: Glass[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const chunkGlasses = this.lookup.get(chunkX + dx)?.get(chunkY + dy);
        if (chunkGlasses) glasses.push(...chunkGlasses);
      }
    }
    return glasses;
  }
}
