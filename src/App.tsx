import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleGlass,
  ConcaveLensGlass,
  ConvexLensGlass,
  Glass,
  PolygonGlass,
  RectangleGlass,
} from "./engine/glass";
import { Light, PointLight } from "./engine/lights";
import { simulateRays } from "./engine/sim";
import type { SimulationParams } from "./types";

function App() {
  const ref = useRef<HTMLDivElement>(null);
  const lightCanvasRef = useRef<HTMLCanvasElement>(null);
  const glassCanvasRef = useRef<HTMLCanvasElement>(null);

  const [x, setX] = useState(0);
  const [y, setY] = useState(0);

  const render = useMemo(
    () => (src: HTMLElement) => {
      const lightCanvas = lightCanvasRef.current;
      if (!lightCanvas) return;
      const glassCanvas = glassCanvasRef.current;
      if (!glassCanvas) return;
      const rect = src.getBoundingClientRect();
      lightCanvas.width = rect.width;
      lightCanvas.height = rect.height;
      lightCanvas.style.width = rect.width + "px";
      lightCanvas.style.height = rect.height + "px";
      glassCanvas.width = rect.width * window.devicePixelRatio;
      glassCanvas.height = rect.height * window.devicePixelRatio;
      glassCanvas.style.width = rect.width + "px";
      glassCanvas.style.height = rect.height + "px";
      const lightCtx = lightCanvas.getContext("2d");
      if (!lightCtx) return;
      const glassCtx = glassCanvas.getContext("2d");
      if (!glassCtx) return;
      const glasses: Glass[] = [
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
      ];
      const lights: Light[] = [
        new PointLight({
          position: [x, y],
          wavelengths: { range: [400, 700], amplitude: 1 },
          amplitude: 1,
        }),
      ];
      const params: SimulationParams = {
        density: 0.85,
        dwavelength: 50,
        maxDistance: 3e3,
        ctx: lightCtx,
      };
      simulateRays(glasses, lights, params);
      {
        const ctx = glassCtx;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.save();
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        ctx.fillStyle = "#ffffff11";
        for (const glass of glasses) {
          ctx.beginPath();
          glass.path(ctx);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    },
    [lightCanvasRef, glassCanvasRef, x, y],
  );

  useEffect(() => {
    const elem = ref.current;
    if (!elem) return;
    render(elem);
    const observer = new ResizeObserver(() => {
      render(elem);
    });
    observer.observe(elem);
    return () => observer.disconnect();
  }, [ref, render]);

  return (
    <div
      ref={ref}
      className="absolute top-0 left-0 bottom-0 right-0 overflow-hidden"
      onMouseMove={(e) => {
        const elem = ref.current;
        if (!elem) return;
        const rect = elem.getBoundingClientRect();
        setX(e.clientX - rect.left);
        setY(e.clientY - rect.top);
      }}
    >
      <canvas
        ref={lightCanvasRef}
        className="block absolute top-0 left-0"
        // style={{ filter: "blur(1px)" }}
      ></canvas>
      <canvas
        ref={glassCanvasRef}
        className="block absolute top-0 left-0"
      ></canvas>
    </div>
  );
}

export default App;
