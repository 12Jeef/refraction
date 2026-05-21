import { LuTally3 } from "react-icons/lu";
import type { Light } from "../engine/lights";
import type { Wavelengths } from "../types";
import Dropdown from "./Dropdown";
import { CgArrowsShrinkH } from "react-icons/cg";
import { TbMathIntegral } from "react-icons/tb";
import { wavelengthToRGB } from "../util";
import { IoAddSharp, IoCloseSharp } from "react-icons/io5";
import WavelengthBar from "./WavelengthBar";

export type WavelengthsType = "POINTS" | "RANGE" | "FUNCTION";
const wavelengthsTypes: WavelengthsType[] = ["POINTS", "RANGE", "FUNCTION"];

export const getWavelengthsType = (
  wavelengths: Wavelengths,
): WavelengthsType => {
  if ("length" in wavelengths) return "POINTS";
  if ("lengths" in wavelengths) return "POINTS";
  if (typeof wavelengths.amplitude === "number") return "RANGE";
  return "FUNCTION";
};

export const fromWavelengthsType = (type: WavelengthsType): Wavelengths => {
  if (type === "POINTS") return { length: 460, amplitude: 1 };
  if (type === "RANGE") return { range: [400, 700], amplitude: 1 };
  return { range: [400, 700], amplitude: () => 1 };
};

function Points({
  wavelengths,
  set,
}: {
  wavelengths: Wavelengths;
  set: (value: Wavelengths) => void;
}) {
  if (!("length" in wavelengths || "lengths" in wavelengths)) return <></>;
  const lengths: number[] =
    "length" in wavelengths ? [wavelengths.length] : wavelengths.lengths;
  const amplitudes: number[] =
    "amplitude" in wavelengths
      ? [wavelengths.amplitude]
      : wavelengths.amplitudes;
  const keys = Array.from(new Array(lengths.length).keys());
  const update = () => {
    if (lengths.length === 1)
      return set({ length: lengths[0], amplitude: amplitudes[0] });
    return set({ lengths: [...lengths], amplitudes: [...amplitudes] });
  };
  return (
    <div className="flex flex-col items-center justify-start">
      <div className="flex flex-row items-center justify-start gap-4 font-bold">
        <button
          className="min-w-4 max-w-4"
          onClick={() => {
            lengths.unshift(460);
            amplitudes.unshift(1);
            update();
          }}
        >
          <IoAddSharp />
        </button>
        <div className="min-w-40 max-w-40">Wavelength (nm)</div>
        <div className="min-w-10 max-w-10">Amp</div>
        <div className="min-w-4 max-w-4"></div>
      </div>
      {keys.map((i) => {
        const length = lengths[i];
        const amplitude = amplitudes[i];
        const rgb = wavelengthToRGB(length, amplitude);
        const rgbMax = Math.max(...rgb);
        for (let i = 0; i < 3; i++) rgb[i] *= 255 / Math.max(rgbMax, 1);
        return (
          <div
            key={i}
            className="flex flex-row items-center justify-start gap-4"
          >
            <div
              className="min-w-4 max-w-4 h-2 rounded-full"
              style={{
                background: `rgb(${rgb.join(",")})`,
              }}
            ></div>
            <div className="min-w-40 max-w-40 flex flex-row items-center justify-center gap-0">
              <input
                className="min-w-10 max-w-10 outline-none"
                value={length}
                onChange={(e) => {
                  lengths[i] = Math.round(e.target.valueAsNumber);
                  update();
                }}
                type="number"
              />
              <div className="relative min-w-30 max-w-30 flex flex-col items-center justify-center">
                <WavelengthBar
                  range={[350, 800]}
                  className="absolute! w-full h-1 top-1/2 -translate-y-1/2 -z-1"
                />
                <input
                  className="w-full outline-none bar"
                  min={350}
                  max={800}
                  value={length}
                  onChange={(e) => {
                    lengths[i] = Math.round(e.target.valueAsNumber);
                    update();
                  }}
                  type="range"
                />
              </div>
            </div>
            <input
              className="min-w-10 max-w-10 outline-none"
              value={amplitude}
              onChange={(e) => {
                amplitudes[i] = Math.max(
                  0,
                  Math.min(100, e.target.valueAsNumber),
                );
                update();
              }}
              step={0.01}
              type="number"
            />
            <button
              className="min-w-4 max-w-4"
              onClick={() => {
                lengths.splice(i, 1);
                amplitudes.splice(i, 1);
                update();
              }}
            >
              <IoCloseSharp />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function RangeSelector({
  wavelengths,
  set,
}: {
  wavelengths: Wavelengths;
  set: (value: Wavelengths) => void;
}) {
  if (!("range" in wavelengths)) return <></>;
  const [l, r] = wavelengths.range;
  const lPercent = Math.max(0, Math.min(1, (l - 350) / (800 - 350)));
  const rPercent = Math.max(0, Math.min(1, (r - 350) / (800 - 350)));
  return (
    <>
      <input
        className="min-w-10 max-w-10 outline-none text-right"
        value={l}
        onChange={(e) => {
          wavelengths.range[0] = Math.round(e.target.valueAsNumber);
          set(wavelengths);
        }}
        type="number"
      />
      <div className="relative min-w-50 max-w-50 flex flex-col items-center justify-center">
        <WavelengthBar
          range={[350, 800]}
          className="absolute! w-full h-1 top-1/2 -translate-y-1/2 -z-1"
        />
        <div
          className="absolute top-1/2 h-0.5 bg-white"
          style={{
            left: `${lPercent * 100}%`,
            width: `${(rPercent - lPercent) * 100}%`,
            transform: "translateY(-50%) translateY(-0.25rem)",
          }}
        ></div>
        <div
          className="absolute top-1/2 h-0.5 bg-white"
          style={{
            left: `${lPercent * 100}%`,
            width: `${(rPercent - lPercent) * 100}%`,
            transform: "translateY(-50%) translateY(0.25rem)",
          }}
        ></div>
        <input
          className="absolute top-1/2 -translate-y-1/2 w-full outline-none multi bar"
          min={350}
          max={800}
          value={l}
          onChange={(e) => {
            wavelengths.range[0] = Math.round(e.target.valueAsNumber);
            set(wavelengths);
          }}
          type="range"
        />
        <input
          className="absolute top-1/2 -translate-y-1/2 w-full outline-none multi bar"
          min={350}
          max={800}
          value={r}
          onChange={(e) => {
            wavelengths.range[1] = Math.round(e.target.valueAsNumber);
            set(wavelengths);
          }}
          type="range"
        />
      </div>
      <input
        className="min-w-10 max-w-10 outline-none text-left"
        value={r}
        onChange={(e) => {
          wavelengths.range[1] = Math.round(e.target.valueAsNumber);
          set(wavelengths);
        }}
        type="number"
      />
    </>
  );
}

function Range({
  wavelengths,
  set,
}: {
  wavelengths: Wavelengths;
  set: (value: Wavelengths) => void;
}) {
  if (!("range" in wavelengths)) return <></>;
  if (typeof wavelengths.amplitude !== "number") return <></>;
  return (
    <div className="flex flex-row items-center justify-start gap-2">
      <RangeSelector wavelengths={wavelengths} set={set} />
      <input
        className="min-w-10 max-w-10 outline-none"
        value={wavelengths.amplitude}
        onChange={(e) => {
          wavelengths.amplitude = Math.max(
            0,
            Math.min(100, e.target.valueAsNumber),
          );
          set(wavelengths);
        }}
        step={0.01}
        type="number"
      />
    </div>
  );
}

function Function({
  wavelengths,
  set,
}: {
  wavelengths: Wavelengths;
  set: (value: Wavelengths) => void;
}) {
  if (!("range" in wavelengths)) return <></>;
  if (typeof wavelengths.amplitude === "number") return <></>;
  return (
    <div className="flex flex-row items-center justify-start gap-2">
      <RangeSelector wavelengths={wavelengths} set={set} />
    </div>
  );
}

export type LightMenuProps = { light: Light; update: () => void };

export default function LightMenu({ light, update }: LightMenuProps) {
  const type = getWavelengthsType(light.wavelengths);

  return (
    <div className="flex flex-col items-start justify-start gap-4">
      {type === "POINTS" && (
        <Points
          wavelengths={light.wavelengths}
          set={(wavelengths) => {
            light.wavelengths = wavelengths;
            update();
          }}
        />
      )}
      {type === "RANGE" && (
        <Range
          wavelengths={light.wavelengths}
          set={(wavelengths) => {
            light.wavelengths = wavelengths;
            update();
          }}
        />
      )}
      {type === "FUNCTION" && (
        <Function
          wavelengths={light.wavelengths}
          set={(wavelengths) => {
            light.wavelengths = wavelengths;
            update();
          }}
        />
      )}
      <Dropdown
        items={wavelengthsTypes}
        selected={type}
        direction="UP"
        set={(value) => {
          if (type === value) return;
          light.wavelengths = fromWavelengthsType(value);
          update();
        }}
        serialize={(value) => {
          if (value === "POINTS")
            return (
              <>
                <LuTally3 className="min-w-4" />
                <div className="w-full">Points</div>
              </>
            );
          if (value === "RANGE")
            return (
              <>
                <CgArrowsShrinkH className="min-w-4" />
                <div className="w-full">Range</div>
              </>
            );
          return (
            <>
              <TbMathIntegral className="min-w-4" />
              <div className="w-full">Function</div>
            </>
          );
        }}
      />
    </div>
  );
}
