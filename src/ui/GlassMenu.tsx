import {
  HiCube,
  HiOutlineCube,
  HiOutlineCubeTransparent,
} from "react-icons/hi";
import {
  defaultMaterial,
  mirrorMaterial,
  vacuumMaterial,
  type Glass,
} from "../engine/glass";
import Dropdown from "./Dropdown";

export type GlassMenuProps = { glass: Glass; update: () => void };

export default function GlassMenu({ glass, update }: GlassMenuProps) {
  return (
    <div className="flex flex-col items-start justify-start">
      <div className="flex flex-row items-center justify-center gap-4">
        <div>Material</div>
        <Dropdown
          items={[vacuumMaterial, defaultMaterial, mirrorMaterial]}
          selected={glass.material}
          direction="UP"
          set={(value) => {
            glass.material = value;
            update();
          }}
          serialize={(value) => {
            if (!value) return "No Material";
            if (value === vacuumMaterial)
              return (
                <>
                  <HiOutlineCubeTransparent className="min-w-4" />
                  <div className="w-full">Vacuum</div>
                </>
              );
            if (value === defaultMaterial)
              return (
                <>
                  <HiOutlineCube className="min-w-4" />
                  <div className="w-full">Glass</div>
                </>
              );
            if (value === mirrorMaterial)
              return (
                <>
                  <HiCube className="min-w-4" />
                  <div className="w-full">Mirror</div>
                </>
              );
          }}
        />
      </div>
    </div>
  );
}
