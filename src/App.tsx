import { useEffect, useRef, useState } from "react";
import {
  CircleGlass,
  ConcaveLensGlass,
  ConvexLensGlass,
  GlassSet,
  PolygonGlass,
  RectangleGlass,
} from "./engine/glass";
import { PointLight } from "./engine/lights";
import { simulateRays } from "./engine/sim";
import type { SimulationParams } from "./types";

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [x, setX] = useState(0);
  const [y, setY] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const glassSet = new GlassSet([
      new CircleGlass({
        center: [200, 400],
        radius: 50,
      }),
      new ConvexLensGlass({
        center: [400, 400],
        thickness: 25,
        length: 100,
        angle: 0,
      }),
      new ConcaveLensGlass({
        center: [600, 400],
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
        center: [1000, 400],
        width: 50,
        height: 100,
        angle: Math.PI / 6,
      }),
    ]);
    const light = new PointLight({
      position: [x, y],
      wavelengths: { range: [400, 700], amplitude: 1 },
      amplitude: 1,
    });
    const params: SimulationParams = {
      density: 0.5,
      dwavelength: 50,
      size: [canvas.width, canvas.height],
      ctx,
      type: "RENDER",
    };
    simulateRays(glassSet, [light], params);
  }, [canvasRef, x, y]);

  return (
    <>
      <canvas
        ref={canvasRef}
        onMouseMove={(e) => {
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            setX(e.clientX - rect.left);
            setY(e.clientY - rect.top);
          }
        }}
      ></canvas>
    </>
  );
}

export default App;
