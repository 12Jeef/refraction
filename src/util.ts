import { vacuumMaterial } from "./engine/glass";
import type {
  FullSDFOutput,
  line,
  Material,
  Ray,
  rect,
  vec2,
  vec3,
  Wavelengths,
} from "./types";

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

export const dot = (a: vec2, b: vec2): number => a[0] * b[0] + a[1] * b[1];
export const cross = (a: vec2, b: vec2): number => a[0] * b[1] - a[1] * b[0];
export const proj = (a: vec2, b: vec2): vec2 => {
  const f = dot(a, b) / (b[0] * b[0] + b[1] * b[1]);
  return [b[0] * f, b[1] * f];
};
export const projComp = (a: vec2, b: vec2): { paraB: vec2; perpB: vec2 } => {
  const paraB = proj(a, b);
  const perpB: vec2 = [a[0] - paraB[0], a[1] - paraB[1]];
  return { paraB, perpB };
};

export const CHUNK_SIZE = 500;

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
  const { normal, internal } = sdfOutput;
  if (internal) {
    normal[0] *= -1;
    normal[1] *= -1;
  }
  const incidentDotNormal = dot(ray.angle, normal);
  if (incidentDotNormal > 0) return [];
  const rays =
    typeof pastMaterial.refractiveIndex === "number" &&
    typeof newMaterial.refractiveIndex === "number"
      ? [ray]
      : subdivideRay(ray, dwavelength);
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

export const wavelengthToRGB = (
  wavelength: number,
  amplitude: number,
): vec3 => {
  const rgb: vec3 = [0, 0, 0];
  if (wavelength >= 380 && wavelength < 440) {
    rgb[0] = -(wavelength - 440) / (440 - 380);
    rgb[1] = 0;
    rgb[2] = 1;
  } else if (wavelength >= 440 && wavelength < 490) {
    rgb[0] = 0;
    rgb[1] = (wavelength - 440) / (490 - 440);
    rgb[2] = 1;
  } else if (wavelength >= 490 && wavelength < 510) {
    rgb[0] = 0;
    rgb[1] = 1;
    rgb[2] = -(wavelength - 510) / (510 - 490);
  } else if (wavelength >= 510 && wavelength < 580) {
    rgb[0] = (wavelength - 510) / (580 - 510);
    rgb[1] = 1;
    rgb[2] = 0;
  } else if (wavelength >= 580 && wavelength < 645) {
    rgb[0] = 1;
    rgb[1] = -(wavelength - 645) / (645 - 580);
    rgb[2] = 0;
  } else if (wavelength >= 645 && wavelength <= 780) {
    rgb[0] = 1;
    rgb[1] = 0;
    rgb[2] = 0;
  }
  const factor =
    wavelength >= 380 && wavelength < 420
      ? 0.3 + (0.7 * (wavelength - 380)) / (420 - 380)
      : wavelength >= 420 && wavelength < 701
        ? 1
        : wavelength >= 701 && wavelength <= 780
          ? 0.3 + (0.7 * (780 - wavelength)) / (780 - 700)
          : 0;
  rgb[0] *= factor * amplitude;
  rgb[1] *= factor * amplitude;
  rgb[2] *= factor * amplitude;
  return rgb;
};

export const wavelengthsToRGB = (
  wavelengths: Wavelengths,
  dwavelength: number,
): vec3 => {
  if ("length" in wavelengths)
    return wavelengthToRGB(wavelengths.length, wavelengths.amplitude);
  const rgb: vec3 = [0, 0, 0];
  for (
    let l = wavelengths.range[0];
    l < wavelengths.range[1];
    l += dwavelength
  ) {
    const amplitude =
      typeof wavelengths.amplitude === "number"
        ? wavelengths.amplitude
        : wavelengths.amplitude(l);
    const wavelengthRGB = wavelengthToRGB(l, amplitude);
    rgb[0] += wavelengthRGB[0];
    rgb[1] += wavelengthRGB[1];
    rgb[2] += wavelengthRGB[2];
  }
  return rgb;
};
