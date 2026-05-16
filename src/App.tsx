import { useEffect, useRef, useState } from "react";
import { CircleGlass, ConvexLensGlass, GlassSet } from "./engine/glass";
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
        center: [400, 400],
        radius: 50,
      }),
      new ConvexLensGlass({
        center: [700, 400],
        thickness: 25,
        length: 100,
        angle: 0,
      }),
    ]);
    const light = new PointLight({
      position: [x, y],
      wavelengths: { range: [400, 700], amplitude: 1 },
      amplitude: 1,
    });
    const rays = light.emit(1);
    const params: SimulationParams = {
      dwavelength: 25,
      size: [canvas.width, canvas.height],
      ctx,
    };
    simulateRays(glassSet, rays, params);
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
