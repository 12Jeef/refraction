import type {
  DirectionalLightProps,
  LightProps,
  PlaneLightProps,
  Ray,
  vec2,
  Wavelengths,
} from "../types";
import { dot, lerp, projComp } from "../util";
import { drawBarPath, drawPlusPath, drawTrianglePath, Knob } from "./knob";

export abstract class Light {
  public position: vec2;
  public wavelengths: Wavelengths;
  public readonly knobs: Knob[];

  public constructor({ position, wavelengths }: LightProps) {
    this.position = position;
    this.wavelengths = wavelengths;
    this.knobs = [];

    this.knobs.push(
      new Knob(
        (p) => (this.position = p),
        () => this.position,
        drawPlusPath(() => this.position),
      ),
    );
  }

  public abstract emit(density: number): Ray[];
  public update(): void {}
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
        transitions: 0,
      });
    }
    return rays;
  }
}

export class DirectionalLight extends Light {
  public angle: number;
  public angleSpread: number;
  private distance: number;

  public constructor({
    angle,
    angleSpread,
    ...lightProps
  }: DirectionalLightProps) {
    super(lightProps);
    this.angle = angle;
    this.angleSpread = angleSpread;
    this.distance = 50;

    this.knobs.push(
      new Knob(
        (p) => {
          const dx = p[0] - this.position[0];
          const dy = p[1] - this.position[1];
          this.distance = Math.max(10, Math.hypot(dx, dy));
          this.angle = Math.atan2(dy, dx);
        },
        () => [
          this.position[0] + Math.cos(this.angle) * this.distance,
          this.position[1] + Math.sin(this.angle) * this.distance,
        ],
        drawBarPath(
          () => [
            this.position[0] + Math.cos(this.angle) * this.distance,
            this.position[1] + Math.sin(this.angle) * this.distance,
          ],
          () => this.angle,
        ),
      ),
      new Knob(
        (p) => {
          const dx = p[0] - this.position[0];
          const dy = p[1] - this.position[1];
          const d = Math.hypot(dx, dy);
          this.distance = Math.max(10, d);
          this.angleSpread = Math.acos(
            dot([dx / d, dy / d], [Math.cos(this.angle), Math.sin(this.angle)]),
          );
        },
        () => [
          this.position[0] +
            Math.cos(this.angle + this.angleSpread) * this.distance,
          this.position[1] +
            Math.sin(this.angle + this.angleSpread) * this.distance,
        ],
        drawBarPath(
          () => [
            this.position[0] +
              Math.cos(this.angle + this.angleSpread) * this.distance,
            this.position[1] +
              Math.sin(this.angle + this.angleSpread) * this.distance,
          ],
          () => this.angle + this.angleSpread,
        ),
      ),
    );
  }

  public emit(density: number): Ray[] {
    const rays: Ray[] = [];
    const step = Math.max(0.1, lerp(1, 0.1, density)) * (Math.PI / 180);
    for (
      let angle = -this.angleSpread;
      angle <= this.angleSpread;
      angle += step
    ) {
      const rad = angle + this.angle;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      rays.push({
        origin: [...this.position],
        position: [...this.position],
        angle: [cos, sin],
        wavelengths: this.wavelengths,
        glass: null,
        distance: 0,
        transitions: 0,
      });
    }
    return rays;
  }

  public update(): void {
    super.update();

    this.distance = lerp(this.distance, 50, 0.1);
  }
}

export class PlaneLight extends Light {
  public length: number;
  public angle: number;
  private distance: number;

  public constructor({ length, angle, ...lightProps }: PlaneLightProps) {
    super(lightProps);
    this.length = length;
    this.angle = angle;
    this.distance = 50;

    this.knobs.push(
      new Knob(
        (p) => {
          const dx = p[0] - this.position[0];
          const dy = p[1] - this.position[1];
          this.distance = Math.max(10, Math.hypot(dx, dy));
          this.angle = Math.atan2(dy, dx);
        },
        () => [
          this.position[0] + Math.cos(this.angle) * this.distance,
          this.position[1] + Math.sin(this.angle) * this.distance,
        ],
        drawBarPath(
          () => [
            this.position[0] + Math.cos(this.angle) * this.distance,
            this.position[1] + Math.sin(this.angle) * this.distance,
          ],
          () => this.angle,
        ),
      ),
      new Knob(
        (p) => {
          const { perpB: perpVec } = projComp(
            [p[0] - this.position[0], p[1] - this.position[1]],
            [Math.cos(this.angle), Math.sin(this.angle)],
          );
          this.length = Math.max(20, Math.hypot(...perpVec)) * 2;
        },
        () => [
          this.position[0] - Math.sin(this.angle) * (this.length / 2),
          this.position[1] + Math.cos(this.angle) * (this.length / 2),
        ],
        drawTrianglePath(
          () => [
            this.position[0] - Math.sin(this.angle) * (this.length / 2),
            this.position[1] + Math.cos(this.angle) * (this.length / 2),
          ],
          () => this.angle + Math.PI / 2,
        ),
      ),
    );
  }

  public emit(density: number): Ray[] {
    const rays: Ray[] = [];
    const step = Math.max(0.1, lerp(1, 0.1, density));
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    for (let i = -this.length / 2; i <= this.length / 2; i += step) {
      const x = this.position[0] - sin * i;
      const y = this.position[1] + cos * i;
      rays.push({
        origin: [x, y],
        position: [x, y],
        angle: [cos, sin],
        wavelengths: this.wavelengths,
        glass: null,
        distance: 0,
        transitions: 0,
      });
    }
    return rays;
  }

  public update(): void {
    super.update();

    this.distance = lerp(this.distance, 50, 0.1);
  }
}
