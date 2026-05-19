import { useEffect, useMemo, useState } from "react";
import {
  CircleGlass,
  ConcaveLensGlass,
  ConvexLensGlass,
  defaultMaterial,
  Glass,
  mirrorMaterial,
  PolygonGlass,
  RectangleGlass,
  vacuumMaterial,
} from "./engine/glass";
import {
  DirectionalLight,
  Light,
  PlaneLight,
  PointLight,
} from "./engine/lights";
import type { vec2 } from "./types";
import { AnimatePresence, motion } from "motion/react";
import Render from "./Render";
import Dropdown from "./ui/Dropdown";
import {
  HiCube,
  HiOutlineCube,
  HiOutlineCubeTransparent,
} from "react-icons/hi";

export default function App() {
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
        wavelengths: { range: [400, 700], amplitude: 1 },
        length: 100,
        angle: 0,
      }),
    ],
    [],
  );
  const [glasses, setGlasses] = useState(glassesBase);
  const [lights, setLights] = useState(lightsBase);
  const [selected, setSelected] = useState<Glass | Light | null>(null);

  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setMenuOpen(false);
  }, [selected]);
  const [menu, setMenu] = useState<HTMLDivElement | null>(null);
  const [menuWidth, setMenuWidth] = useState(0);
  const [menuHeight, setMenuHeight] = useState(0);
  useEffect(() => {
    if (!menu) return;
    const onResize = () => {
      const rect = menu.getBoundingClientRect();
      setMenuWidth(rect.width);
      setMenuHeight(rect.height);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(menu);
    onResize();
    const interval = setInterval(onResize, 100);
    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, [menuOpen, menu]);

  return (
    <div className="absolute top-0 left-0 bottom-0 right-0 overflow-hidden">
      <Render
        glasses={glasses}
        lights={lights}
        selected={selected}
        setSelected={setSelected}
      />
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ x: "-5rem", y: "5rem", opacity: 0, scale: 0.75 }}
              animate={{ x: "0rem", y: "0rem", opacity: 1, scale: 1 }}
              exit={{ x: "-5rem", y: "5rem", opacity: 0, scale: 0.75 }}
              className="absolute bottom-6 left-6 pl-10 py-2 min-h-10 flex flex-row items-end justify-start z-1"
              style={{ transformOrigin: "0% 100%" }}
              ref={setMenu}
            >
              <div className="absolute bottom-5 left-5 -translate-x-1/2 translate-y-1/2">
                <motion.div
                  initial={{ x: "-3rem", y: "3rem" }}
                  animate={{ x: "0rem", y: "0rem", transition: { delay: 0.3 } }}
                  exit={{ x: "-3rem", y: "3rem" }}
                  className="absolute -bottom-1.25 -left-1.5 -translate-x-1/2 translate-y-1/2 w-1 h-1 rounded-full bg-white"
                ></motion.div>
                <motion.div
                  initial={{ x: "-3rem", y: "3rem" }}
                  animate={{ x: "0rem", y: "0rem", transition: { delay: 0.2 } }}
                  exit={{ x: "-3rem", y: "3rem" }}
                  className="absolute -bottom-1.25 left-1.5 -translate-x-1/2 translate-y-1/2 w-1 h-1 rounded-full bg-white"
                ></motion.div>
                <motion.div
                  initial={{ x: "-3rem", y: "3rem" }}
                  animate={{ x: "0rem", y: "0rem", transition: { delay: 0.1 } }}
                  exit={{ x: "-3rem", y: "3rem" }}
                  className="absolute bottom-1.25 left-0 -translate-x-1/2 translate-y-1/2 w-1 h-1 rounded-full bg-white"
                ></motion.div>
              </div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{
                  scale: 1,
                  width: menuWidth + "px",
                  height: menuHeight + "px",
                  transition: { scale: { delay: 0.3 } },
                }}
                exit={{ scale: 0 }}
                className="absolute bottom-0 left-0 rounded-3xl bg-white/15 pointer-events-none -z-1"
              ></motion.div>
              <div
                className="absolute bottom-0 left-0 w-10 h-10 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                }}
              ></div>
              <AnimatePresence>
                {menuOpen && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="mx-3 text-sm"
                    >
                      {selected instanceof Glass && (
                        <>
                          <div className="flex flex-col items-start justify-start">
                            <div className="flex flex-row items-center justify-center gap-4">
                              <div>Material</div>
                              <Dropdown
                                items={[
                                  vacuumMaterial,
                                  defaultMaterial,
                                  mirrorMaterial,
                                ]}
                                selected={selected.material}
                                direction="UP"
                                set={(value) => {
                                  selected.material = value;
                                  setGlasses([...glasses]);
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
                        </>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
