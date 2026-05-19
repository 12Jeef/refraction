import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export type DropdownProps<T> = {
  items: T[];
  selected: T | null;
  serialize: (value: T | null) => any;
  set: (value: T) => void;
  direction?: "UP" | "DOWN";
};

export default function Dropdown<T>({
  items,
  selected,
  serialize,
  set,
  direction = "DOWN",
}: DropdownProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const elem = ref.current;
    if (!elem) return;
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (elem.contains(e.target as Node)) return;
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
    };
    document.body.addEventListener("mousedown", onMouseDown, true);
    return () =>
      document.body.removeEventListener("mousedown", onMouseDown, true);
  }, [ref, open]);

  return (
    <div className="relative text-sm" ref={ref}>
      <button
        className="px-2 py-1 bg-white/25 rounded-lg flex flex-row items-center justify-center gap-1 min-w-30 backdrop-blur-lg"
        onClick={() => setOpen(!open)}
      >
        {serialize(selected)}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ scale: 0.75, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.75, opacity: 0 }}
            className={`absolute ${direction === "DOWN" ? "top-full translate-y-1" : "bottom-full -translate-y-1"} w-full flex flex-col items-stretch justify-stretch bg-white/25 rounded-lg overflow-hidden z-10 backdrop-blur-lg`}
            style={{
              transformOrigin: direction === "DOWN" ? "50% 0%" : "50% 100%",
            }}
          >
            {items.map((item, i) => (
              <button
                key={i}
                className="px-2 py-1 flex flex-row items-center justify-center gap-1 min-w-30 hover:bg-white/10 transition-colors duration-200"
                onClick={() => set(item)}
              >
                {serialize(item)}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
