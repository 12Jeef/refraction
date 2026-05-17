import type {
  ChunkSpan,
  CircleGlassProps,
  LensGlassProps,
  FullSDFOutput,
  GlassProps,
  Material,
  PolygonGlassProps,
  SDFOutput,
  vec2,
} from "../types";
import { dot, getChunk, lineDistance, projComp } from "../util";

export const vacuumMaterial: Material = {
  refractiveIndex: 1,
};
export const defaultMaterial: Material = {
  refractiveIndex: (length) => 1.5046 + 4200 / (length * length),
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
    const internal = sdf.distance < 0;
    return { ...sdf, glass: this, internal };
  }
  public abstract path(ctx: CanvasRenderingContext2D): void;
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

  public path(ctx: CanvasRenderingContext2D): void {
    ctx.arc(...this.center, this.radius, 0, 2 * Math.PI);
  }
}

export abstract class LensGlass extends Glass {
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
  }: LensGlassProps) {
    super(glassProps);
    this.center = center;
    this.thickness = thickness;
    this.length = length;
    this.angle = angle;
  }

  public chunkSpan(): ChunkSpan {
    const dimMax = (this.thickness + this.length) / 2;
    const min: vec2 = [this.center[0] - dimMax, this.center[1] - dimMax];
    const max: vec2 = [this.center[0] + dimMax, this.center[1] + dimMax];
    const chunkMin = getChunk(min);
    const chunkMax = getChunk(max);
    return {
      x: [chunkMin[0], chunkMax[0]],
      y: [chunkMin[1], chunkMax[1]],
    };
  }

  public get heading(): vec2 {
    return [
      Math.cos(this.angle * (Math.PI / 180)),
      Math.sin(this.angle * (Math.PI / 180)),
    ];
  }

  public get circleRadius(): number {
    // (R-t/2)^2 + (l/2)^2 = R^2
    // R^2 - Rt + t^2/4 + l^2/4 = R^2
    // t^2/4 + l^2/4 = Rt
    // t^2 + l^2 = 4Rt
    return (this.thickness ** 2 + this.length ** 2) / (4 * this.thickness);
  }
}

export class ConvexLensGlass extends LensGlass {
  protected sdfInternal(position: vec2): SDFOutput {
    const heading: vec2 = this.heading;
    const circleRadius = this.circleRadius;

    const to: vec2 = [
      position[0] - this.center[0],
      position[1] - this.center[1],
    ];
    const toDistance = Math.hypot(...to);
    to[0] /= toDistance;
    to[1] /= toDistance;
    const d = dot(to, heading);
    const circleCenter: vec2 = [
      this.center[0] -
        Math.sign(d) * heading[0] * (circleRadius - this.thickness / 2),
      this.center[1] -
        Math.sign(d) * heading[1] * (circleRadius - this.thickness / 2),
    ];
    const dx = position[0] - circleCenter[0];
    const dy = position[1] - circleCenter[1];
    const distance = Math.hypot(dx, dy);
    const normal: vec2 = [dx / distance, dy / distance];
    return { distance: distance - circleRadius, normal };
  }

  public path(ctx: CanvasRenderingContext2D): void {
    const heading: vec2 = this.heading;
    const circleRadius = this.circleRadius;

    const dx = heading[0] * (circleRadius - this.thickness / 2);
    const dy = heading[1] * (circleRadius - this.thickness / 2);
    const angle = Math.asin(this.length / 2 / circleRadius);
    ctx.arc(
      this.center[0] + dx,
      this.center[1] + dy,
      circleRadius,
      Math.PI - angle,
      Math.PI + angle,
    );
    ctx.arc(
      this.center[0] - dx,
      this.center[1] - dy,
      circleRadius,
      -angle,
      +angle,
    );
  }
}

export class ConcaveLensGlass extends LensGlass {
  protected sdfInternal(position: [number, number]): SDFOutput {
    const heading: vec2 = this.heading;
    const circleRadius = this.circleRadius;

    const to: vec2 = [
      position[0] - this.center[0],
      position[1] - this.center[1],
    ];
    const { paraB: paraVec, perpB: perpVec } = projComp(to, heading);
    const paraDist = Math.hypot(...paraVec);
    const paraSD = paraDist - this.thickness;
    const perpDist = Math.hypot(...perpVec);
    const perpSD = perpDist - this.length / 2;
    const paraSDF: SDFOutput = {
      distance: paraSD,
      normal: [paraVec[0] / paraDist, paraVec[1] / paraDist],
    };
    const perpSDF: SDFOutput = {
      distance: perpSD,
      normal: [perpVec[0] / perpDist, perpVec[1] / perpDist],
    };
    const toDistance = Math.hypot(...to);
    to[0] /= toDistance;
    to[1] /= toDistance;
    const d = dot(to, heading);
    const circleCenter: vec2 = [
      this.center[0] +
        Math.sign(d) * heading[0] * (circleRadius + this.thickness / 2),
      this.center[1] +
        Math.sign(d) * heading[1] * (circleRadius + this.thickness / 2),
    ];
    const dx = position[0] - circleCenter[0];
    const dy = position[1] - circleCenter[1];
    const distance = Math.hypot(dx, dy);
    const circleSDF: SDFOutput = {
      distance: circleRadius - distance,
      normal: [-dx / distance, -dy / distance],
    };
    if (perpSD > 0) {
      if (paraSD > 0) return perpSD < paraSD ? paraSDF : perpSDF;
      return perpSDF;
    }
    if (paraDist < circleRadius) {
      if (circleSDF.distance < 0)
        if (perpSD > circleSDF.distance) return perpSDF;
      return circleSDF;
    }
    return paraSDF;
  }

  public path(ctx: CanvasRenderingContext2D): void {
    const heading: vec2 = this.heading;
    const circleRadius = this.circleRadius;

    const dx = heading[0] * (circleRadius + this.thickness / 2);
    const dy = heading[1] * (circleRadius + this.thickness / 2);
    const angle = Math.asin(this.length / 2 / circleRadius);
    ctx.arc(
      this.center[0] + dx,
      this.center[1] + dy,
      circleRadius,
      Math.PI - angle,
      Math.PI + angle,
    );
    ctx.arc(
      this.center[0] - dx,
      this.center[1] - dy,
      circleRadius,
      -angle,
      +angle,
    );
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
        const edgeLength = Math.hypot(...edge);
        minNormal = [edge[1] / edgeLength, -edge[0] / edgeLength];
      }
    }
    if (inside) minDistance *= -1;
    return { distance: minDistance, normal: minNormal };
  }

  public path(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.vertices.length; i++) {
      if (i > 0) ctx.lineTo(...this.vertices[i]);
      else ctx.moveTo(...this.vertices[i]);
    }
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
