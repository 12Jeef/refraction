import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleGlass,
  ConcaveLensGlass,
  ConvexLensGlass,
  Glass,
  PolygonGlass,
  RectangleGlass,
} from "./engine/glass";
import {
  DirectionalLight,
  Light,
  PlaneLight,
  PointLight,
} from "./engine/lights";
import { simulateRays } from "./engine/sim";
import type { SimulationParams, vec2 } from "./types";
import { lerp } from "./util";
import type { Knob } from "./engine/knob";

function App() {
  const ref = useRef<HTMLDivElement>(null);
  const lightCanvasRef = useRef<HTMLCanvasElement>(null);
  const glassCanvasRef = useRef<HTMLCanvasElement>(null);
  const knobCanvasRef = useRef<HTMLCanvasElement>(null);

  const glassesBase: Glass[] = useMemo(
    () => [
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
        center: [800, 400],
        vertices: Array.from(new Array(3).keys()).map(
          (i) =>
            [
              50 * Math.cos(-Math.PI / 2 + i * ((2 * Math.PI) / 3)),
              50 * Math.sin(-Math.PI / 2 + i * ((2 * Math.PI) / 3)),
            ] as vec2,
        ),
        angle: 0,
        knobAngleOffset: -Math.PI / 2,
      }),
      new RectangleGlass({
        center: [1400, 400],
        width: 50,
        height: 100,
        angle: Math.PI / 6,
      }),
    ],
    [],
  );
  const lightsBase: Light[] = useMemo(
    () => [
      new PointLight({
        position: [600, 200],
        wavelengths: { range: [400, 500], amplitude: 1 },
      }),
      new DirectionalLight({
        position: [800, 200],
        wavelengths: { range: [500, 600], amplitude: 1 },
        angle: 0,
        angleSpread: Math.PI / 6,
      }),
      new PlaneLight({
        position: [1000, 200],
        wavelengths: { range: [600, 700], amplitude: 1 },
        length: 100,
        angle: 0,
      }),
    ],
    [],
  );
  const [glasses, setGlasses] = useState(glassesBase);
  const [lights, setLights] = useState(lightsBase);
  const selectedRef = useRef<Glass | Light | null>(null);

  const renderGlassesAndLights = useMemo(
    () => (src: HTMLElement) => {
      const glassCanvas = glassCanvasRef.current;
      const knobCanvas = knobCanvasRef.current;
      if (!glassCanvas) return;
      if (!knobCanvas) return;
      const rect = src.getBoundingClientRect();
      glassCanvas.width = knobCanvas.width =
        rect.width * window.devicePixelRatio;
      glassCanvas.height = knobCanvas.height =
        rect.height * window.devicePixelRatio;
      glassCanvas.style.width = knobCanvas.style.width = rect.width + "px";
      glassCanvas.style.height = knobCanvas.style.height = rect.height + "px";
      const glassCtx = glassCanvas.getContext("2d");
      const knobCtx = knobCanvas.getContext("2d");
      if (!glassCtx) return;
      if (!knobCtx) return;
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
        const ctx = knobCtx;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.save();
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        ctx.fillStyle = ctx.strokeStyle = "#ffffff";
        ctx.lineJoin = "round";
        for (const glass of glasses) {
          ctx.lineWidth = glass.value * 2;
          ctx.globalAlpha = glass.value;
          ctx.beginPath();
          glass.path(ctx);
          ctx.closePath();
          ctx.stroke();
          ctx.globalAlpha = 1;
          for (const knob of glass.knobs) {
            ctx.beginPath();
            knob.path(ctx);
            ctx.closePath();
            ctx.fill();
          }
        }
        for (const light of lights) {
          for (const knob of light.knobs) {
            ctx.beginPath();
            knob.path(ctx);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    },
    [glassCanvasRef, knobCanvasRef, glasses, lights],
  );
  const simulateLights = useMemo(
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
    const observer = new ResizeObserver(() => (simulateLightsRequested = true));
    observer.observe(elem);
    let dragged: { thing: Glass | Light; knob: Knob | null } | null = null;
    const findHovered = (
      pos: vec2,
    ): { thing: Glass | Light; knob: Knob | null } | null => {
      for (const glass of glasses) {
        const sdf = glass.sdf(pos);
        for (const knob of glass.knobs) {
          const knobPos = knob.position;
          const d = Math.hypot(pos[0] - knobPos[0], pos[1] - knobPos[1]);
          if (d <= 5) return { thing: glass, knob };
        }
        if (sdf.distance < 0) return { thing: glass, knob: null };
      }
      let nearDistance = Infinity;
      let nearLight: Light | null = null;
      for (const light of lights) {
        let knobNearDistance = Infinity;
        for (const knob of light.knobs) {
          const knobPos = knob.position;
          const d = Math.hypot(pos[0] - knobPos[0], pos[1] - knobPos[1]);
          if (d <= 5) return { thing: light, knob };
          knobNearDistance = Math.min(knobNearDistance, d);
        }
        if (knobNearDistance < nearDistance) {
          nearDistance = knobNearDistance;
          nearLight = light;
        }
      }
      if (nearDistance < 40 && nearLight)
        return { thing: nearLight, knob: null };
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
    let simulateLightsRequested: boolean = true;
    const update = () => {
      frame = window.requestAnimationFrame(update);
      for (const glass of glasses)
        glass.value = lerp(
          glass.value,
          glass === selectedRef.current ? 1 : 0,
          0.1,
        );
      for (const light of lights)
        light.value = lerp(
          light.value,
          light === selectedRef.current ? 1 : 0,
          0.1,
        );
      if (dragged) {
        for (const glass of glasses)
          for (let i = 0; i < glass.knobs.length; i++) {
            const knob = glass.knobs[i];
            stepKnob(
              knob,
              i,
              glass === selectedRef.current || glass === dragged.thing,
              knob === dragged.knob ? 3 : 0,
            );
          }
        for (const light of lights)
          for (let i = 0; i < light.knobs.length; i++) {
            const knob = light.knobs[i];
            stepKnob(
              knob,
              i,
              light === selectedRef.current || light === dragged.thing,
              knob === dragged.knob ? 3 : 0,
            );
          }
      } else {
        for (const glass of glasses) glass.update();
        for (const light of lights) light.update();
        const hovered = findHovered(mouse);
        if (hovered) {
          for (const glass of glasses)
            for (let i = 0; i < glass.knobs.length; i++) {
              const knob = glass.knobs[i];
              stepKnob(
                knob,
                i,
                glass === selectedRef.current || glass === hovered.thing,
                knob === hovered.knob ? 2 : 1,
              );
            }
          for (const light of lights)
            for (let i = 0; i < light.knobs.length; i++) {
              const knob = light.knobs[i];
              stepKnob(
                knob,
                i,
                light === selectedRef.current || light === hovered.thing,
                knob === hovered.knob ? 2 : 1,
              );
            }
        } else {
          for (const glass of glasses)
            for (let i = 0; i < glass.knobs.length; i++) {
              const knob = glass.knobs[i];
              stepKnob(knob, i, glass === selectedRef.current);
            }
          for (const light of lights)
            for (let i = 0; i < light.knobs.length; i++) {
              const knob = light.knobs[i];
              stepKnob(knob, i, light === selectedRef.current);
            }
        }
      }
      renderGlassesAndLights(elem);
      if (!simulateLightsRequested) return;
      simulateLightsRequested = false;
      simulateLights(elem);
    };
    update();
    const onMouseDown = (e: MouseEvent) => {
      mouse = [e.offsetX, e.offsetY];
      dragged = findHovered(mouse);
      selectedRef.current = dragged?.thing ?? null;
      if (!dragged?.knob) dragged = null;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (!dragged) return;
      dragged = null;
    };
    const onMouseMove = (e: MouseEvent) => {
      mouse = [e.offsetX, e.offsetY];
      if (!dragged) return;
      if (!dragged.knob) return;
      dragged.knob.drag(mouse);
      simulateLightsRequested = true;
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
  }, [
    ref,
    renderGlassesAndLights,
    simulateLights,
    glasses,
    lights,
    selectedRef,
  ]);

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
        ref={knobCanvasRef}
        className="block absolute top-0 left-0"
        style={{ mixBlendMode: "difference" }}
      ></canvas>
    </div>
  );
}

export default App;
