import { useEffect, useRef } from "react";
import {
  CircleGlass,
  ConcaveLensGlass,
  ConvexLensGlass,
  PolygonGlass,
  RectangleGlass,
  type Glass,
} from "../engine/glass";
import type { vec2 } from "../types";
import { RiAsterisk } from "react-icons/ri";
import { LuChevronLeft } from "react-icons/lu";

const defaultGlasses: Glass[] = [
  new CircleGlass({ center: [0, 0], radius: 50 }),
  new ConvexLensGlass({ center: [0, 0], thickness: 25, length: 100, angle: 0 }),
  new ConcaveLensGlass({
    center: [0, 0],
    thickness: 25,
    length: 100,
    angle: 0,
  }),
  new PolygonGlass({
    center: [0, 10],
    vertices: Array.from(new Array(3).keys()).map(
      (i) =>
        [
          50 * Math.cos(-Math.PI / 2 + i * ((2 * Math.PI) / 3)),
          50 * Math.sin(-Math.PI / 2 + i * ((2 * Math.PI) / 3)),
        ] as vec2,
    ),
    angle: 0,
  }),
  new RectangleGlass({
    center: [0, 0],
    width: 50,
    height: 100,
    angle: 0,
  }),
];

function GlassRender({ glass }: { glass: Glass }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 150, 150);
    ctx.save();
    ctx.translate(75, 75);
    ctx.beginPath();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 10;
    ctx.lineJoin = "round";
    glass.path(ctx);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }, [glass, ref]);

  return (
    <canvas className="w-8 h-8" width={150} height={150} ref={ref}></canvas>
  );
}

export type AddMenuProps = {};

export default function AddMenu({}: AddMenuProps) {
  return (
    <div className="flex flex-row items-center justify-center gap-2">
      {defaultGlasses.map((glass, i) => (
        <button key={i} className="w-8 h-8">
          <GlassRender glass={glass} />
        </button>
      ))}
      <div className="min-w-0.5 h-8 bg-white/50"></div>
      <button className="w-8 h-8 flex flex-row items-center justify-center">
        <RiAsterisk className="scale-200" />
      </button>
      <button className="w-8 h-8 flex flex-row items-center justify-center">
        <LuChevronLeft className="scale-200" />
      </button>
      <button className="w-8 h-8 flex flex-row items-center justify-center">
        <div className="min-w-0.5 h-4 bg-white"></div>
      </button>
    </div>
  );
}
