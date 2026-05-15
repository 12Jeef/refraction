import { useEffect, useRef } from "react";
import { CircleGlass, GlassSet } from "./engine/glass";
import { PointLight } from "./engine/lights";
import { simulateRays } from "./engine/sim";
import type { SimulationParams } from "./types";

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const glass = new CircleGlass({
      center: [400, 200],
      radius: 50,
    });
    const glassSet = new GlassSet([glass]);
    const light = new PointLight({
      position: [200, 200],
      wavelengths: { range: [400, 700], amplitude: 1 },
      amplitude: 1,
    });
    const rays = light.emit(1);
    const buffer = new Float32Array(canvas.width * canvas.height);
    const params: SimulationParams = {
      dwavelength: 100,
      size: [canvas.width, canvas.height],
      buffer,
    };
    simulateRays(glassSet, rays, params);
    const data = ctx.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < buffer.length; i++) {
      const value = Math.min(255, buffer[i] * 255);
      data.data[i * 4] = value;
      data.data[i * 4 + 1] = value;
      data.data[i * 4 + 2] = value;
      data.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
  }, [canvasRef]);

  return (
    <>
      <canvas ref={canvasRef}></canvas>
    </>
  );
}

export default App;
