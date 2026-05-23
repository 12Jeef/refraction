import { useEffect, useMemo, useRef, useState } from "react";
import type { Glass } from "./engine/glass";
import type { Light } from "./engine/lights";
import type { SimulationParams, vec2 } from "./types";
import { simulateRays } from "./engine/sim";
import type { Knob, Knobby } from "./engine/knob";
import { lerp } from "./util";

export type RenderProps = {
  glasses: Glass[];
  setGlasses: (glasses: Glass[]) => void;
  lights: Light[];
  setLights: (lights: Light[]) => void;
  selected: Knobby | null;
  setSelected: (selected: Knobby | null) => void;
  adding: Knobby | null;
  clearAdding: () => void;
  bindKeys?: boolean;
};

export default function Render({
  glasses,
  setGlasses,
  lights,
  setLights,
  selected,
  setSelected,
  adding,
  clearAdding,
  bindKeys = true,
}: RenderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lightCanvasRef = useRef<HTMLCanvasElement>(null);
  const glassCanvasRef = useRef<HTMLCanvasElement>(null);
  const knobCanvasRef = useRef<HTMLCanvasElement>(null);

  const selectedRef = useRef<Knobby | null>(null);
  selectedRef.current = selected;

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

  const [addKnobI, setAddKnobI] = useState(0);
  useEffect(() => {
    setAddKnobI(0);
    if (adding) setSelected(adding);
  }, [adding]);
  useEffect(() => {
    const elem = ref.current;
    if (!elem) return;
    const knobOrder = adding ? adding.getAddKnobOrder() : [];
    if (adding && addKnobI >= knobOrder.length) {
      clearAdding();
      return;
    }
    let dragged: { thing: Knobby; knobs: Knob[] } | null = adding
      ? { thing: adding, knobs: knobOrder[addKnobI] }
      : null;
    const observer = new ResizeObserver(() => (simulateLightsRequested = true));
    observer.observe(elem);
    const findHovered = (
      pos: vec2,
    ): { thing: Knobby; knobs: Knob[] } | null => {
      for (const glass of glasses) {
        const sdf = glass.sdf(pos);
        for (const knob of glass.knobs) {
          const knobPos = knob.position;
          const d = Math.hypot(pos[0] - knobPos[0], pos[1] - knobPos[1]);
          if (d <= 5) return { thing: glass, knobs: [knob] };
        }
        if (sdf.distance < 0) return { thing: glass, knobs: [] };
      }
      let nearDistance = Infinity;
      let nearLight: Light | null = null;
      for (const light of lights) {
        let knobNearDistance = Infinity;
        for (const knob of light.knobs) {
          const knobPos = knob.position;
          const d = Math.hypot(pos[0] - knobPos[0], pos[1] - knobPos[1]);
          if (d <= 5) return { thing: light, knobs: [knob] };
          knobNearDistance = Math.min(knobNearDistance, d);
        }
        if (knobNearDistance < nearDistance) {
          nearDistance = knobNearDistance;
          nearLight = light;
        }
      }
      if (nearDistance < 40 && nearLight)
        return { thing: nearLight, knobs: [] };
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
              dragged.knobs.includes(knob) ? 3 : 0,
            );
          }
        for (const light of lights)
          for (let i = 0; i < light.knobs.length; i++) {
            const knob = light.knobs[i];
            stepKnob(
              knob,
              i,
              light === selectedRef.current || light === dragged.thing,
              dragged.knobs.includes(knob) ? 3 : 0,
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
                hovered.knobs.includes(knob) ? 2 : 1,
              );
            }
          for (const light of lights)
            for (let i = 0; i < light.knobs.length; i++) {
              const knob = light.knobs[i];
              stepKnob(
                knob,
                i,
                light === selectedRef.current || light === hovered.thing,
                hovered.knobs.includes(knob) ? 2 : 1,
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
      if (adding) {
        setAddKnobI(addKnobI + 1);
        return;
      }
      mouse = [e.offsetX, e.offsetY];
      dragged = findHovered(mouse);
      setSelected(dragged?.thing ?? null);
      if ((dragged?.knobs.length ?? 0) <= 0) dragged = null;
    };
    const onMouseUp = () => {
      if (adding) return;
      dragged = null;
    };
    const onMouseMove = (e: MouseEvent) => {
      mouse = [e.offsetX, e.offsetY];
      if (!dragged) return;
      for (const knob of dragged.knobs) knob.drag(mouse);
      simulateLightsRequested = true;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!bindKeys) return;
      if (e.key === "Escape") {
        setSelected(null);
        clearAdding();
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        if (selectedRef.current) {
          setGlasses(glasses.filter((g) => g !== selectedRef.current));
          setLights(lights.filter((l) => l !== selectedRef.current));
          setSelected(null);
        }
      }
    };
    elem.addEventListener("mousedown", onMouseDown);
    elem.addEventListener("mouseup", onMouseUp);
    elem.addEventListener("mousemove", onMouseMove);
    document.body.addEventListener("keydown", onKeyDown);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      elem.removeEventListener("mousedown", onMouseDown);
      elem.removeEventListener("mouseup", onMouseUp);
      elem.removeEventListener("mousemove", onMouseMove);
      document.body.removeEventListener("keydown", onKeyDown);
    };
  }, [
    ref,
    renderGlassesAndLights,
    simulateLights,
    glasses,
    lights,
    selectedRef,
    adding,
    addKnobI,
    bindKeys,
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
