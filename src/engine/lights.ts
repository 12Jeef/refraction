import type {
  DirectionalLightProps,
  LightProps,
  PlaneLightProps,
  Ray,
  vec2,
  Wavelengths,
} from "../types";
import { lerp } from "../util";

export abstract class Light {
  public position: vec2;
  public wavelengths: Wavelengths;
  public amplitude: number;

  public constructor({ position, wavelengths, amplitude }: LightProps) {
    this.position = position;
    this.wavelengths = wavelengths;
    this.amplitude = amplitude;
  }

  public abstract emit(density: number): Ray[];
}

export class PlaneLight extends Light {
  public length: number;
  public angle: number;

  public constructor({ length, angle, ...lightProps }: PlaneLightProps) {
    super(lightProps);
    this.length = length;
    this.angle = angle;
  }

  public emit(density: number): Ray[] {
    const rays: Ray[] = [];
    const step = Math.max(0.1, lerp(1, 0.1, density));
    const cos = Math.cos(this.angle * (Math.PI / 180));
    const sin = Math.sin(this.angle * (Math.PI / 180));
    for (let i = -this.length / 2; i <= this.length / 2; i += step) {
      rays.push({
        origin: [...this.position],
        position: [...this.position],
        angle: [cos, sin],
        wavelengths: this.wavelengths,
        glass: null,
        distance: 0,
      });
    }
    return rays;
  }
}

export class PointLight extends Light {
  public emit(density: number): Ray[] {
    const step = Math.max(0.1, lerp(1, 0.1, density));
    const rays: Ray[] = [];
    for (let angle = 0; angle < 360; angle += step) {
      const rad = (angle * Math.PI) / 180;
      rays.push({
        origin: [...this.position],
        position: [...this.position],
        angle: [Math.cos(rad), Math.sin(rad)],
        wavelengths: this.wavelengths,
        glass: null,
        distance: 0,
      });
    }
    return rays;
  }
}

export class DirectionalLight extends Light {
  public angle: number;
  public angleSpread: number;

  public constructor({
    angle,
    angleSpread,
    ...lightProps
  }: DirectionalLightProps) {
    super(lightProps);
    this.angle = angle;
    this.angleSpread = angleSpread;
  }

  public emit(density: number): Ray[] {
    const rays: Ray[] = [];
    const step = Math.max(0.1, lerp(1, 0.1, density));
    for (
      let angle = -this.angleSpread / 2;
      angle <= this.angleSpread / 2;
      angle += step
    ) {
      const rad = (angle + this.angle) * (Math.PI / 180);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      rays.push({
        origin: [...this.position],
        position: [...this.position],
        angle: [cos, sin],
        wavelengths: this.wavelengths,
        glass: null,
        distance: 0,
      });
    }
    return rays;
  }
}
