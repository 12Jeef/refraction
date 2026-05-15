import type {
  ChunkSpan,
  CircleGlassProps,
  FullSDFOutput,
  GlassProps,
  Material,
  SDFOutput,
  vec2,
} from "../types";
import { getChunk } from "../util";

export const vacuumMaterial: Material = {
  refractiveIndex: 1,
};
export const defaultMaterial: Material = {
  refractiveIndex: (length) => 1.5046 + 0.0042 / (length * length),
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

  protected sdfInternal(position: [number, number]): SDFOutput {
    const dx = position[0] - this.center[0];
    const dy = position[1] - this.center[1];
    const distance = Math.sqrt(dx * dx + dy * dy);
    const normal: [number, number] = [dx / distance, dy / distance];
    return { distance, normal };
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

  public getGlassesAt(chunk: vec2): Glass[] {
    const glasses: Glass[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const chunkGlasses = this.lookup.get(chunk[0] + dx)?.get(chunk[1] + dy);
        if (chunkGlasses) glasses.push(...chunkGlasses);
      }
    }
    return glasses;
  }
}
