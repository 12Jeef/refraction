import { useEffect, useRef, type HTMLAttributes } from "react";
import type { vec2 } from "../types";
import { lerp, wavelengthToRGB, wavelengthToRGBString } from "../util";

export type WavelengthBarProps = {
  range: vec2;
} & HTMLAttributes<HTMLDivElement>;

export default function WavelengthBar({
  range,
  className = "",
  ...props
}: WavelengthBarProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = 100;
    canvas.height = 1;
    for (let i = 0; i < canvas.width; i++) {
      ctx.fillStyle = wavelengthToRGBString(
        lerp(...range, i / canvas.width),
        1,
      );
      ctx.fillRect(i, 0, 1, 1);
    }
  }, [range, ref]);

  return (
    <div className={`relative ${className}`} {...props}>
      <canvas
        ref={ref}
        className="absolute top-0 left-0 right-0 bottom-0 w-full h-full"
      ></canvas>
    </div>
  );
}
