import type {
  CircleGlassProps,
  LensGlassProps,
  FullSDFOutput,
  GlassProps,
  Material,
  PolygonGlassProps,
  SDFOutput,
  vec2,
  RectangleGlassProps,
} from "../types";
import { dot, lineDistance, projComp } from "../util";

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

  protected abstract sdfInternal(position: vec2): SDFOutput;
  public sdf(position: vec2): FullSDFOutput {
    const sdf = this.sdfInternal(position);
    const internal = sdf.distance < 0;
    return { ...sdf, glass: this, internal };
  }
  public abstract path(ctx: CanvasRenderingContext2D): void;
}

export class CircleGlass extends Glass {
  public center: vec2;
  public radius: number;

  public constructor({ center, radius, ...glassProps }: CircleGlassProps) {
    super(glassProps);
    this.center = center;
    this.radius = radius;
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
  public center: vec2;
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
  protected sdfInternal(position: vec2): SDFOutput {
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

export class RectangleGlass extends Glass {
  public center: vec2;
  public width: number;
  public height: number;
  public angle: number;

  public constructor({
    center,
    width,
    height,
    angle,
    ...glassProps
  }: RectangleGlassProps) {
    super(glassProps);
    this.center = center;
    this.width = width;
    this.height = height;
    this.angle = angle;
  }

  protected sdfInternal(position: vec2): SDFOutput {
    const { paraB: paraVec, perpB: perpVec } = projComp(
      [position[0] - this.center[0], position[1] - this.center[1]],
      [Math.cos(this.angle), Math.sin(this.angle)],
    );
    const paraDist = Math.hypot(...paraVec);
    const paraSDF: SDFOutput = {
      distance: paraDist - this.width / 2,
      normal: [paraVec[0] / paraDist, paraVec[1] / paraDist],
    };
    const perpDist = Math.hypot(...perpVec);
    const perpSDF: SDFOutput = {
      distance: perpDist - this.height / 2,
      normal: [perpVec[0] / perpDist, perpVec[1] / perpDist],
    };
    if (paraSDF.distance > 0) {
      if (perpSDF.distance > 0)
        return paraSDF.distance > perpSDF.distance ? paraSDF : perpSDF;
      return paraSDF;
    }
    if (perpSDF.distance > 0) return perpSDF;
    return paraSDF.distance > perpSDF.distance ? paraSDF : perpSDF;
  }

  public path(ctx: CanvasRenderingContext2D): void {
    const xVec: vec2 = [
      Math.cos(this.angle) * (this.width / 2),
      Math.sin(this.angle) * (this.width / 2),
    ];
    const yVec: vec2 = [
      -Math.sin(this.angle) * (this.height / 2),
      Math.cos(this.angle) * (this.height / 2),
    ];
    ctx.moveTo(
      this.center[0] + xVec[0] + yVec[0],
      this.center[1] + xVec[1] + yVec[1],
    );
    ctx.lineTo(
      this.center[0] + xVec[0] - yVec[0],
      this.center[1] + xVec[1] - yVec[1],
    );
    ctx.lineTo(
      this.center[0] - xVec[0] - yVec[0],
      this.center[1] - xVec[1] - yVec[1],
    );
    ctx.lineTo(
      this.center[0] - xVec[0] + yVec[0],
      this.center[1] - xVec[1] + yVec[1],
    );
  }
}

export class PolygonGlass extends Glass {
  public vertices: vec2[];

  public constructor({ vertices, ...glassProps }: PolygonGlassProps) {
    super(glassProps);
    this.vertices = vertices;
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
