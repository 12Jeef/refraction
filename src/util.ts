import { vacuumMaterial } from "./engine/glass";
import type {
  FullSDFOutput,
  line,
  Material,
  Ray,
  rect,
  vec2,
  Wavelengths,
} from "./types";

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

export const dot = (a: vec2, b: vec2): number => a[0] * b[0] + a[1] * b[1];
export const cross = (a: vec2, b: vec2): number => a[0] * b[1] - a[1] * b[0];

export const CHUNK_SIZE = 100;

export const getChunk = (position: vec2): vec2 => [
  Math.floor(position[0] / CHUNK_SIZE),
  Math.floor(position[1] / CHUNK_SIZE),
];

export const subdivideWavelengths = (
  wavelengths: Wavelengths,
  dwavelength: number,
): Wavelengths[] => {
  if ("length" in wavelengths) return [wavelengths];
  const [start, stop] = wavelengths.range;
  const result: Wavelengths[] = [];
  for (let i = start; i < stop; i += dwavelength) {
    const divisionStart = i;
    const divisionStop = Math.min(i + dwavelength, stop);
    result.push({
      range: [divisionStart, divisionStop],
      amplitude: wavelengths.amplitude,
    });
  }
  return result;
};

export const subdivideRay = (ray: Ray, dwavelength: number): Ray[] => {
  const wavelengths = subdivideWavelengths(ray.wavelengths, dwavelength);
  return wavelengths.map((w) => ({ ...ray, wavelengths: w }));
};

export const meanWavelength = (wavelengths: Wavelengths): number => {
  if ("length" in wavelengths) return wavelengths.length;
  const [start, stop] = wavelengths.range;
  return (start + stop) / 2;
};

export const refractiveIndex = (
  material: Material,
  wavelengths: Wavelengths,
): number =>
  typeof material.refractiveIndex === "number"
    ? material.refractiveIndex
    : material.refractiveIndex(meanWavelength(wavelengths));

export const amplifyWavelengths = (
  wavelengths: Wavelengths,
  factor: number,
): Wavelengths => {
  if ("length" in wavelengths)
    return {
      length: wavelengths.length,
      amplitude: wavelengths.amplitude * factor,
    };
  const amplitude = wavelengths.amplitude;
  if (typeof amplitude === "number")
    return {
      range: wavelengths.range,
      amplitude: amplitude * factor,
    };
  return {
    range: wavelengths.range,
    amplitude: (wavelength) => amplitude(wavelength) * factor,
  };
};

export const transitionRay = (
  ray: Ray,
  sdfOutput: FullSDFOutput,
  dwavelength: number,
): Ray[] => {
  const pastMaterial = ray.glass?.material ?? vacuumMaterial;
  const newMaterial = sdfOutput.glass?.material ?? vacuumMaterial;
  const { normal } = sdfOutput;
  const incidentDotNormal = ray.angle[0] * normal[0] + ray.angle[1] * normal[1];
  // const rays =
  //   typeof pastMaterial.refractiveIndex === "number" &&
  //   typeof newMaterial.refractiveIndex === "number"
  //     ? [ray]
  //     : subdivideRay(ray, dwavelength);
  const rays = [ray];
  const newRays: Ray[] = [];
  for (const ray of rays) {
    const reflectedAngleVec: vec2 = [
      ray.angle[0] - 2 * incidentDotNormal * normal[0],
      ray.angle[1] - 2 * incidentDotNormal * normal[1],
    ];
    const n1 = refractiveIndex(pastMaterial, ray.wavelengths);
    const n2 = refractiveIndex(newMaterial, ray.wavelengths);
    const eta = n1 / n2;
    const normalCoeff =
      eta * incidentDotNormal +
      Math.sqrt(1 - eta * eta * (1 - incidentDotNormal * incidentDotNormal));
    const refractedAngleVec: vec2 = [
      eta * ray.angle[0] - normalCoeff * normal[0],
      eta * ray.angle[1] - normalCoeff * normal[1],
    ];
    const R0 = ((n1 - n2) / (n1 + n2)) ** 2;
    const R = R0 + (1 - R0) * (1 + incidentDotNormal) ** 5;
    const T = 1 - R;
    if (R > 0.1)
      newRays.push({
        origin: ray.position,
        position: [
          ray.position[0] + 1 * reflectedAngleVec[0],
          ray.position[1] + 1 * reflectedAngleVec[1],
        ],
        wavelengths: amplifyWavelengths(ray.wavelengths, R),
        angle: reflectedAngleVec,
        glass: ray.glass,
        nTransitions: ray.nTransitions + 1,
      });
    if (T > 0.1)
      newRays.push({
        origin: ray.position,
        position: [
          ray.position[0] + 1 * refractedAngleVec[0],
          ray.position[1] + 1 * refractedAngleVec[1],
        ],
        wavelengths: amplifyWavelengths(ray.wavelengths, T),
        angle: refractedAngleVec,
        glass: sdfOutput.glass,
        nTransitions: ray.nTransitions + 1,
      });
  }
  return newRays;
};

export const rectOutlineMoveDistance = (
  point: vec2,
  angle: vec2,
  rect: rect,
): number => {
  const [min, max] = rect;
  const hypot = Math.hypot(max[0] - min[0], max[1] - min[1]);
  const point2: vec2 = [
    point[0] + angle[0] * hypot,
    point[1] + angle[1] * hypot,
  ];
  const point2Clamped: vec2 = [
    Math.max(min[0], Math.min(max[0], point2[0])),
    Math.max(min[1], Math.min(max[1], point2[1])),
  ];
  return Math.hypot(point2Clamped[0] - point[0], point2Clamped[1] - point[1]);
};

export const lineDistance = (point: vec2, line: line): number => {
  const [start, end] = line;
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0)
    return Math.sqrt((point[0] - start[0]) ** 2 + (point[1] - start[1]) ** 2);
  const t = Math.max(
    0,
    Math.min(
      1,
      dot([point[0] - start[0], point[1] - start[1]], [dx, dy]) /
        (length * length),
    ),
  );
  const closestPoint: vec2 = [start[0] + t * dx, start[1] + t * dy];
  return Math.sqrt(
    (point[0] - closestPoint[0]) ** 2 + (point[1] - closestPoint[1]) ** 2,
  );
};
