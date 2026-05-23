import { useEffect, useMemo, useState } from "react";
import { Glass } from "./engine/glass";
import { Light } from "./engine/lights";
import { AnimatePresence, motion } from "motion/react";
import Render from "./Render";
import GlassMenu from "./ui/GlassMenu";
import LightMenu from "./ui/LightMenu";
import AddMenu from "./ui/AddMenu";
import type { Knobby } from "./engine/knob";
import { IoTriangleSharp } from "react-icons/io5";

export default function App() {
  const glassesBase: Glass[] = useMemo(() => [], []);
  const lightsBase: Light[] = useMemo(() => [], []);
  const [glasses, setGlasses] = useState(glassesBase);
  const [lights, setLights] = useState(lightsBase);
  const [selected, setSelected] = useState<Knobby | null>(null);
  const [adding, setAdding] = useState<Knobby | null>(null);

  const [menuShown, setMenuShown] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuLast, setMenuLast] = useState<Knobby | null>(null);
  useEffect(() => {
    setMenuShown(!adding);
  }, [adding]);
  useEffect(() => {
    if (selected instanceof Glass && menuLast instanceof Glass) return;
    if (selected instanceof Light && menuLast instanceof Light) return;
    if (selected == null && menuLast == null) return;
    setMenuOpen(false);
  }, [selected]);
  useEffect(() => {
    if (!menuShown) {
      setMenuOpen(false);
      setMenuLast(null);
      return;
    }
    if (!menuOpen) return;
    setMenuLast(selected);
  }, [selected, menuShown, menuOpen]);
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
  useEffect(() => {
    setMenuShown(false);
    const timeout = setTimeout(() => setMenuShown(true), 1e3);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="absolute top-0 left-0 bottom-0 right-0 overflow-hidden">
      <Render
        glasses={glasses}
        setGlasses={setGlasses}
        lights={lights}
        setLights={setLights}
        selected={selected}
        setSelected={setSelected}
        adding={adding}
        clearAdding={() => setAdding(null)}
        bindKeys={!menuOpen}
      />
      <AnimatePresence>
        {menuShown && (
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
                transition: {
                  scale: { delay: 0.3 },
                  duration: 0.5,
                  type: "spring",
                  bounce: 0.25,
                },
              }}
              exit={{ scale: 0 }}
              className="absolute bottom-0 left-0 rounded-3xl bg-white/15 pointer-events-none -z-1 backdrop-blur-lg"
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
                    {menuLast instanceof Glass && (
                      <GlassMenu
                        glass={menuLast}
                        update={() => setGlasses([...glasses])}
                      />
                    )}
                    {menuLast instanceof Light && (
                      <LightMenu
                        light={menuLast}
                        update={() => setLights([...lights])}
                      />
                    )}
                    {!menuLast && (
                      <AddMenu
                        add={(thing) => {
                          if (thing instanceof Glass) glasses.push(thing);
                          if (thing instanceof Light) lights.push(thing);
                          setGlasses([...glasses]);
                          setLights([...lights]);
                          setAdding(thing);
                        }}
                      />
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0.5, scale: 1 }}
        animate={{
          opacity: 0,
          scale: 1.25,
          filter: "blur(5rem)",
          transition: { delay: 1, duration: 10 },
        }}
        className="absolute top-1/2 left-1/2 -translate-1/2 pointer-events-none text-9xl tracking-widest flex flex-row items-center justify-center"
      >
        <span>REFR</span>
        <IoTriangleSharp className="translate-y-2 w-[0.75em] h-[0.75em]" />
        <span>CTION</span>
      </motion.div>
    </div>
  );
}
