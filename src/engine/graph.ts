export type ControlPoint = {
  x: number;
  y: number;
  m: number;
};

export type ControlPoints = ControlPoint[];

export const sortControlPoints = (pts: ControlPoints): ControlPoints =>
  [...pts].sort((a, b) => a.x - b.x);

export const sample = (
  pts: ControlPoints,
  x: number,
): { y: number; m: number } => {
  pts = sortControlPoints(pts);
  if (pts.length <= 0) return { y: 0, m: 0 };
  const first = pts[0],
    last = pts[pts.length - 1];
  if (x < first.x) return { y: first.y + (x - first.x) * first.m, m: first.m };
  if (x >= last.x) return { y: last.y + (x - last.x) * last.m, m: last.m };
  let l = 0,
    r = pts.length - 1;
  while (true) {
    const m = Math.floor((l + r) / 2);
    const min = pts[m].x;
    const max = pts[m + 1].x;
    if (x < min) {
      r = m - 1;
      continue;
    }
    if (x >= max) {
      l = m + 1;
      continue;
    }
    const dx = max - min;
    const { y: p0, m: m0 } = pts[m];
    const { y: p1, m: m1 } = pts[m + 1];
    const t = (x - min) / dx;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    const dh00 = 6 * t2 - 6 * t;
    const dh10 = 3 * t2 - 4 * t + 1;
    const dh01 = -6 * t2 + 6 * t;
    const dh11 = 3 * t2 - 2 * t;
    return {
      y: h00 * p0 + h10 * (m0 * dx) + h01 * p1 + h11 * (m1 * dx),
      m: (dh00 * p0 + dh10 * (m0 * dx) + dh01 * p1 + dh11 * (m1 * dx)) / dx,
    };
  }
};
