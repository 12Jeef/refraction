import { useEffect, useRef, type HTMLAttributes } from "react";
import {
  sample,
  sortControlPoints,
  type ControlPoint,
  type ControlPoints,
} from "../engine/graph";
import type { vec2 } from "../types";
import { lerp } from "../util";
import { Knob } from "../engine/knob";

type Conversion = (v: number) => number;

export type GraphProps = {
  pts: ControlPoints;
  setPts: (pts: ControlPoints) => void;
  xRange?: vec2;
  yRange?: vec2;
  render?: (
    ctx: CanvasRenderingContext2D,
    toCanvasX: Conversion,
    toCanvasY: Conversion,
  ) => void;
  renderSlice?: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    cx: number,
    cy: number,
    w: number,
    h: number,
  ) => void;
} & HTMLAttributes<HTMLDivElement>;

export default function Graph({
  pts,
  setPts,
  xRange,
  yRange,
  render,
  renderSlice,
  className = "",
  ...props
}: GraphProps) {
  const ref = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const ptsRef = useRef<ControlPoints>([]);
  ptsRef.current = pts;

  const hoveredRef = useRef<Knob | ControlPoint | null>(null);
  const draggedRef = useRef<Knob | null>(null);
  const dragRequestRef = useRef<number>(-1);
  const knobsRef = useRef<Knob[]>([]);
  const selectedRef = useRef<number>(-1);

  useEffect(() => {
    const elem = ref.current;
    if (!elem) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = -1;

    let lastMinX = Infinity,
      lastMaxX = -Infinity;
    let lastMinY = Infinity,
      lastMaxY = -Infinity;
    let lastPadding = -1;
    let toCanvasX: Conversion = (x) => x;
    let toCanvasY: Conversion = (y) => y;
    let fromCanvasX: Conversion = (x) => x;
    let fromCanvasY: Conversion = (y) => y;

    let renderRequested = true;

    const find = ([mx, my]: vec2): Knob | ControlPoint | null => {
      const r = 5 * window.devicePixelRatio;
      for (const knob of knobsRef.current) {
        const [x, y] = knob.position;
        const d = Math.hypot(mx - x, my - y);
        if (d < r) return knob;
      }
      const x = fromCanvasX(mx);
      const { y, m } = sample(pts, x);
      const cy = toCanvasY(y);
      if (Math.abs(my - cy) < r) return { x, y, m };
      return null;
    };

    const update = () => {
      frame = window.requestAnimationFrame(update);

      const pts = ptsRef.current;

      const xs = pts.map(({ x }) => x);
      const ys = pts.map(({ y }) => y);
      const [minX, maxX] = xRange ?? [Math.min(...xs), Math.max(...xs)];
      const [minY, maxY] = yRange ?? [Math.min(...ys), Math.max(...ys)];
      const padding = 20 * window.devicePixelRatio;
      if (
        lastMinX !== minX ||
        lastMaxX !== maxX ||
        lastMinY !== minY ||
        lastMaxY !== maxY ||
        lastPadding !== padding
      ) {
        lastMinX = minX;
        lastMaxX = maxX;
        lastMinY = minY;
        lastMaxY = maxY;
        lastPadding = padding;
        renderRequested = true;
      }
      fromCanvasX = (x: number) =>
        lerp(minX, maxX, (x - padding) / (canvas.width - 2 * padding));
      fromCanvasY = (y: number) =>
        lerp(maxY, minY, (y - padding) / (canvas.height - 2 * padding));
      toCanvasX = (x: number) =>
        lerp(padding, canvas.width - padding, (x - minX) / (maxX - minX));
      toCanvasY = (y: number) =>
        lerp(canvas.height - padding, padding, (y - minY) / (maxY - minY));

      if (knobsRef.current.length !== pts.length * 3) {
        renderRequested = true;
        knobsRef.current = [];
        for (let i = 0; i < pts.length; i++) {
          const main = new Knob(
            ([x, y]) => {
              x = fromCanvasX(x);
              y = fromCanvasY(y);
              const { m } = ptsRef.current[i];
              ptsRef.current[i] = { x, y, m };
              setPts(ptsRef.current);
            },
            () => {
              const { x, y } = ptsRef.current[i];
              return [toCanvasX(x), toCanvasY(y)];
            },
          );
          const slopeL = new Knob(
            ([x2, y2]) => {
              x2 = fromCanvasX(x2);
              y2 = fromCanvasY(y2);
              const { x, y } = ptsRef.current[i];
              ptsRef.current[i].m = (y2 - y) / (x2 - x);
              setPts(ptsRef.current);
            },
            () => {
              const { x, y, m } = ptsRef.current[i];
              const x1 = toCanvasX(x);
              const y1 = toCanvasY(y);
              const x2 = toCanvasX(x + 1);
              const y2 = toCanvasY(y + m);
              const dx = x2 - x1,
                dy = y2 - y1;
              const hypot = Math.hypot(dx, dy);
              const cos = dx / hypot;
              const sin = dy / hypot;
              return [
                x1 + 20 * window.devicePixelRatio * cos,
                y1 + 20 * window.devicePixelRatio * sin,
              ];
            },
          );
          const slopeR = new Knob(
            ([x2, y2]) => {
              x2 = fromCanvasX(x2);
              y2 = fromCanvasY(y2);
              const { x, y } = ptsRef.current[i];
              ptsRef.current[i].m = (y2 - y) / (x2 - x);
              setPts(ptsRef.current);
            },
            () => {
              const { x, y, m } = ptsRef.current[i];
              const x1 = toCanvasX(x);
              const y1 = toCanvasY(y);
              const x2 = toCanvasX(x - 1);
              const y2 = toCanvasY(y - m);
              const dx = x2 - x1,
                dy = y2 - y1;
              const hypot = Math.hypot(dx, dy);
              const cos = dx / hypot;
              const sin = dy / hypot;
              return [
                x1 + 20 * window.devicePixelRatio * cos,
                y1 + 20 * window.devicePixelRatio * sin,
              ];
            },
          );
          knobsRef.current.push(main, slopeL, slopeR);
        }
      }

      if (
        dragRequestRef.current >= 0 &&
        dragRequestRef.current < knobsRef.current.length
      ) {
        draggedRef.current = knobsRef.current[dragRequestRef.current];
        dragRequestRef.current = -1;
      }

      for (const knob of knobsRef.current) {
        const wantedScale =
          knob === hoveredRef.current || knob === draggedRef.current ? 1.5 : 1;
        knob.scale = lerp(knob.scale, wantedScale, 0.1);
        if (Math.abs(knob.scale - wantedScale) > 0.01) renderRequested = true;
      }

      if (draggedRef.current) {
        selectedRef.current = Math.floor(
          knobsRef.current.indexOf(draggedRef.current) / 3,
        );
        renderRequested = true;
      }

      if (!renderRequested) return;
      renderRequested = false;

      const rect = elem.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      render?.(ctx, toCanvasX, toCanvasY);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2 * window.devicePixelRatio;
      ctx.beginPath();
      const slices: [number, number, number, number, number, number][] = [];
      let first = true;
      for (
        let cx = padding;
        cx <= canvas.width - padding;
        cx += 2.5 * window.devicePixelRatio
      ) {
        const x = lerp(
          minX,
          maxX,
          (cx - padding) / (canvas.width - 2 * padding),
        );
        const y = sample(pts, x).y;
        const cy = toCanvasY(y);
        const cyClamp = Math.max(
          padding,
          Math.min(canvas.height - padding, cy),
        );
        slices.push([
          x,
          y,
          cx,
          cyClamp,
          2.5 * window.devicePixelRatio,
          canvas.height - padding - cyClamp,
        ]);
        if (cy < padding || cy > canvas.height - padding) {
          first = true;
          continue;
        }
        if (first) {
          first = false;
          ctx.moveTo(cx, cy);
          continue;
        }
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.save();
      ctx.globalCompositeOperation = "destination-over";
      for (const slice of slices) renderSlice?.(ctx, ...slice);
      ctx.restore();
      for (let i = 0; i < pts.length; i++) {
        ctx.fillStyle = ctx.strokeStyle =
          selectedRef.current === i ? "#0088ff" : "#ffffff";
        const [cx, cy] = knobsRef.current[i * 3].position;
        const [slopeX1, slopeY1] = knobsRef.current[i * 3 + 1].position;
        const [slopeX2, slopeY2] = knobsRef.current[i * 3 + 2].position;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, canvas.height - padding);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.moveTo(slopeX1, slopeY1);
        ctx.lineTo(slopeX2, slopeY2);
        ctx.stroke();
      }
      const renderPoint = (cx: number, cy: number, scale = 1) => {
        const r = 3 * window.devicePixelRatio * scale;
        ctx.globalCompositeOperation = "source-over";
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.fill();
        if (r > ctx.lineWidth) {
          ctx.globalCompositeOperation = "destination-out";
          ctx.beginPath();
          ctx.arc(cx, cy, r - ctx.lineWidth, 0, 2 * Math.PI);
          ctx.fill();
          ctx.globalCompositeOperation = "source-over";
        }
      };
      for (let i = 0; i < knobsRef.current.length; i++) {
        const knob = knobsRef.current[i];
        ctx.fillStyle = ctx.strokeStyle =
          selectedRef.current === Math.floor(i / 3) ? "#0088ff" : "#ffffff";
        renderPoint(...knob.position, knob.scale);
      }
    };
    update();
    const observer = new ResizeObserver(() => (renderRequested = true));
    observer.observe(elem);
    const onMouseDown = (e: MouseEvent) => {
      const mouse: vec2 = [
        e.offsetX * window.devicePixelRatio,
        e.offsetY * window.devicePixelRatio,
      ];
      if (draggedRef.current) return;
      const found = find(mouse);
      if (!found) {
        selectedRef.current = -1;
        renderRequested = true;
        return;
      }
      if ("x" in found) {
        const pts = sortControlPoints([...ptsRef.current, found]);
        dragRequestRef.current = pts.indexOf(found) * 3;
        setPts(pts);
        return;
      }
      draggedRef.current = found;
    };
    const onMouseMove = (e: MouseEvent) => {
      const mouse: vec2 = [
        e.offsetX * window.devicePixelRatio,
        e.offsetY * window.devicePixelRatio,
      ];
      hoveredRef.current = find(mouse);
      if (!draggedRef.current) return;
      draggedRef.current.drag(mouse);
      renderRequested = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      draggedRef.current = null;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        if (
          selectedRef.current >= 0 &&
          selectedRef.current < ptsRef.current.length
        ) {
          ptsRef.current.splice(selectedRef.current, 1);
          selectedRef.current = -1;
          setPts([...ptsRef.current]);
          renderRequested = true;
        }
      }
    };
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    document.body.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      document.body.removeEventListener("keydown", onKeyDown);
    };
  }, [
    xRange,
    yRange,
    render,
    ref,
    canvasRef,
    ptsRef,
    hoveredRef,
    draggedRef,
    dragRequestRef,
    knobsRef,
    selectedRef,
  ]);

  return (
    <div className={`${className} relative`} ref={ref} {...props}>
      <canvas className="absolute top-0 left-0" ref={canvasRef}></canvas>
    </div>
  );
}
