import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleGlass,
  ConcaveLensGlass,
  ConvexLensGlass,
  Glass,
  Knob,
  PolygonGlass,
  RectangleGlass,
} from "./engine/glass";
import { Light, PointLight } from "./engine/lights";
import { simulateRays } from "./engine/sim";
import type { SimulationParams, vec2 } from "./types";
import { lerp } from "./util";

function App() {
  const ref = useRef<HTMLDivElement>(null);
  const lightCanvasRef = useRef<HTMLCanvasElement>(null);
  const glassCanvasRef = useRef<HTMLCanvasElement>(null);
  const glassKnobCanvasRef = useRef<HTMLCanvasElement>(null);

  const [glasses, setGlasses] = useState([
    new CircleGlass({
      center: [200, 400],
      radius: 50,
    }),
    new ConvexLensGlass({
      center: [500, 400],
      thickness: 25,
      length: 100,
      angle: 0,
    }),
    new ConcaveLensGlass({
      center: [1100, 400],
      thickness: 25,
      length: 100,
      angle: 0,
    }),
    new PolygonGlass({
      vertices: [
        [800, 400 - (100 * (Math.sqrt(3) / 2)) / 2],
        [850, 400 + (100 * (Math.sqrt(3) / 2)) / 2],
        [750, 400 + (100 * (Math.sqrt(3) / 2)) / 2],
      ],
    }),
    new RectangleGlass({
      center: [1400, 400],
      width: 50,
      height: 100,
      angle: Math.PI / 6,
    }),
  ]);
  const [lights, setLights] = useState([
    new PointLight({
      position: [800, 200],
      wavelengths: { range: [400, 700], amplitude: 1 },
      amplitude: 1,
    }),
  ]);

  const renderGlasses = useMemo(
    () => (src: HTMLElement) => {
      const glassCanvas = glassCanvasRef.current;
      const glassKnobCanvas = glassKnobCanvasRef.current;
      if (!glassCanvas) return;
      if (!glassKnobCanvas) return;
      const rect = src.getBoundingClientRect();
      glassCanvas.width = glassKnobCanvas.width =
        rect.width * window.devicePixelRatio;
      glassCanvas.height = glassKnobCanvas.height =
        rect.height * window.devicePixelRatio;
      glassCanvas.style.width = glassKnobCanvas.style.width = rect.width + "px";
      glassCanvas.style.height = glassKnobCanvas.style.height =
        rect.height + "px";
      const glassCtx = glassCanvas.getContext("2d");
      const glassKnobCtx = glassKnobCanvas.getContext("2d");
      if (!glassCtx) return;
      if (!glassKnobCtx) return;
      {
        const ctx = glassCtx;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.save();
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        ctx.fillStyle = ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        for (const glass of glasses) {
          ctx.beginPath();
          glass.path(ctx);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
      {
        const ctx = glassKnobCtx;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.save();
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        ctx.fillStyle = "#0088ff";
        for (const glass of glasses) {
          for (const knob of glass.knobs) {
            ctx.beginPath();
            ctx.arc(...knob.getPosition(), 3 * knob.scale, 0, 2 * Math.PI);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    },
    [glassCanvasRef, glassKnobCanvasRef, glasses],
  );
  const renderLights = useMemo(
    () => (src: HTMLElement) => {
      const lightCanvas = lightCanvasRef.current;
      if (!lightCanvas) return;
      const rect = src.getBoundingClientRect();
      lightCanvas.width = rect.width;
      lightCanvas.height = rect.height;
      lightCanvas.style.width = rect.width + "px";
      lightCanvas.style.height = rect.height + "px";
      const lightCtx = lightCanvas.getContext("2d");
      if (!lightCtx) return;
      const params: SimulationParams = {
        density: 0.75,
        dwavelength: 50,
        maxDistance: 3e3,
        ctx: lightCtx,
      };
      simulateRays(glasses, lights, params);
    },
    [lightCanvasRef, glasses, lights],
  );

  useEffect(() => {
    const elem = ref.current;
    if (!elem) return;
    const observer = new ResizeObserver(() => {
      renderGlasses(elem);
      renderLights(elem);
    });
    observer.observe(elem);
    let dragged: { glass: Glass; knob: Knob | null } | null = null;
    const findHovered = (
      pos: vec2,
    ): { glass: Glass; knob: Knob | null } | null => {
      for (const glass of glasses) {
        const sdf = glass.sdf(pos);
        for (const knob of glass.knobs) {
          const knobPos = knob.getPosition();
          const d = Math.hypot(pos[0] - knobPos[0], pos[1] - knobPos[1]);
          if (d <= 5) return { glass, knob };
        }
        if (sdf.distance < 0) return { glass, knob: null };
      }
      return null;
    };
    const stepKnob = (
      knob: Knob,
      i: number,
      value: boolean,
      scale?: number,
    ) => {
      const now = Date.now() / 1e3;
      if (knob.value !== value) {
        knob.value = value;
        knob.time = now;
      }
      knob.scale = lerp(
        knob.scale,
        (now - knob.time > i * 0.1 ? value : !value) ? (scale ?? 1) : 0,
        0.1,
      );
    };
    let mouse: vec2 = [0, 0];
    let frame: number = -1;
    let renderLightsRequested: boolean = true;
    const update = () => {
      frame = window.requestAnimationFrame(update);
      if (dragged) {
        for (const glass of glasses)
          for (let i = 0; i < glass.knobs.length; i++) {
            const knob = glass.knobs[i];
            stepKnob(knob, i, knob === dragged.knob, 3);
          }
      } else {
        const hovered = findHovered(mouse);
        if (hovered) {
          for (const glass of glasses)
            for (let i = 0; i < glass.knobs.length; i++) {
              const knob = glass.knobs[i];
              stepKnob(
                knob,
                i,
                glass === hovered.glass,
                knob === hovered.knob ? 2 : 1,
              );
            }
        } else {
          for (const glass of glasses)
            for (let i = 0; i < glass.knobs.length; i++) {
              const knob = glass.knobs[i];
              stepKnob(knob, i, false);
            }
        }
      }
      renderGlasses(elem);
      if (!renderLightsRequested) return;
      renderLightsRequested = false;
      renderLights(elem);
    };
    update();
    const onMouseDown = (e: MouseEvent) => {
      mouse = [e.offsetX, e.offsetY];
      dragged = findHovered(mouse);
    };
    const onMouseUp = (e: MouseEvent) => {
      if (!dragged) return;
      dragged = null;
    };
    const onMouseMove = (e: MouseEvent) => {
      mouse = [e.offsetX, e.offsetY];
      if (!dragged) return;
      if (!dragged.knob) return;
      dragged.knob.onDrag(mouse);
      renderLightsRequested = true;
    };
    elem.addEventListener("mousedown", onMouseDown);
    elem.addEventListener("mouseup", onMouseUp);
    elem.addEventListener("mousemove", onMouseMove);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      elem.removeEventListener("mousedown", onMouseDown);
      elem.removeEventListener("mouseup", onMouseUp);
      elem.removeEventListener("mousemove", onMouseMove);
    };
  }, [ref, renderGlasses, renderLights, glasses]);

  return (
    <div
      ref={ref}
      className="absolute top-0 left-0 bottom-0 right-0 overflow-hidden"
    >
      <canvas
        ref={lightCanvasRef}
        className="block absolute top-0 left-0"
      ></canvas>
      <canvas
        ref={glassCanvasRef}
        className="block absolute top-0 left-0 opacity-10"
      ></canvas>
      <canvas
        ref={glassKnobCanvasRef}
        className="block absolute top-0 left-0"
      ></canvas>
    </div>
  );
}

export default App;
