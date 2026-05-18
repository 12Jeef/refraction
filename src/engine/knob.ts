import type { vec2 } from "../types";

export type DrawPathFunction = (
  ctx: CanvasRenderingContext2D,
  knob: Knob,
) => void;

export const drawPlusPath =
  (
    position: () => vec2,
    thickness: number = 2,
    size: number = 8,
  ): DrawPathFunction =>
  (ctx, knob) => {
    const [x, y] = position();
    const t2 = (thickness / 2) * Math.min(knob.scale, 1),
      s2 = (size / 2) * knob.scale;
    const poly: vec2[] = [];
    for (let i = 0; i < 4; i++) {
      const sx = [1, 1, -1, -1][i];
      const sy = [1, -1, -1, 1][i];
      const corner: vec2[] = [
        [t2 * sx, s2 * sy],
        [t2 * sx, t2 * sy],
        [s2 * sx, t2 * sy],
      ];
      if (i % 2) corner.reverse();
      poly.push(...corner);
    }
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      p[0] += x;
      p[1] += y;
      if (i > 0) ctx.lineTo(...p);
      else ctx.moveTo(...p);
    }
  };
export const drawTrianglePath =
  (
    position: () => vec2,
    angle: () => number,
    size: number = 6,
  ): DrawPathFunction =>
  (ctx, knob) => {
    const [x, y] = position();
    const theta = angle();
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const poly: vec2[] = [
      [-size * (Math.sqrt(3) / 2), 0],
      [0, -size / 2],
      [0, size / 2],
    ];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      p[0] *= knob.scale;
      p[1] *= knob.scale;
      [p[0], p[1]] = [p[0] * cos - p[1] * sin, p[0] * sin + p[1] * cos];
      p[0] += x;
      p[1] += y;
      if (i > 0) ctx.lineTo(...p);
      else ctx.moveTo(...p);
    }
  };
export const drawBarPath =
  (
    position: () => vec2,
    angle: () => number,
    size: vec2 = [6, 2],
  ): DrawPathFunction =>
  (ctx, knob) => {
    const [x, y] = position();
    const theta = angle();
    const [w, h] = size;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const poly: vec2[] = [
      [-w / 2, h / 2],
      [w / 2, h / 2],
      [w / 2, -h / 2],
      [-w / 2, -h / 2],
    ];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      p[0] *= knob.scale;
      p[1] *= Math.min(knob.scale, 1);
      [p[0], p[1]] = [p[0] * cos - p[1] * sin, p[0] * sin + p[1] * cos];
      p[0] += x;
      p[1] += y;
      if (i > 0) ctx.lineTo(...p);
      else ctx.moveTo(...p);
    }
  };

export class Knob {
  private readonly onDrag: (position: vec2) => void;
  private readonly getPosition: () => vec2;
  private readonly drawPath: DrawPathFunction | null;
  public time: number;
  public value: boolean;
  public scale: number;

  public constructor(
    onDrag: (position: vec2) => void,
    getPosition: () => vec2,
    drawPath?: (ctx: CanvasRenderingContext2D, knob: Knob) => void,
  ) {
    this.onDrag = onDrag;
    this.getPosition = getPosition;
    this.drawPath = drawPath ?? null;
    this.time = 0;
    this.value = false;
    this.scale = 0;
  }

  public drag(position: vec2) {
    this.onDrag(position);
  }

  public get position(): vec2 {
    return this.getPosition();
  }

  public path(ctx: CanvasRenderingContext2D): void {
    if (this.drawPath) this.drawPath(ctx, this);
    else ctx.arc(...this.position, 3 * this.scale, 0, 2 * Math.PI);
  }
}
