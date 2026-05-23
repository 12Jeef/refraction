import { vacuumMaterial } from "./engine/glass";
import type {
  FullSDFOutput,
  line,
  Material,
  Ray,
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

export const subdivideWavelengths = (
  wavelengths: Wavelengths,
  dwavelength: number,
): Wavelengths[] => {
  if ("length" in wavelengths) return [wavelengths];
  if ("lengths" in wavelengths)
    return wavelengths.lengths.map((length, i) => ({
      length,
      amplitude: wavelengths.amplitudes[i],
    }));
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
  if ("lengths" in wavelengths) {
    const amplitudeSum = wavelengths.amplitudes.reduce((a, b) => a + b, 0);
    return wavelengths.lengths.reduce(
      (a, b, i) => a + (b * wavelengths.amplitudes[i]) / amplitudeSum,
      0,
    );
  }
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
  if ("lengths" in wavelengths)
    return {
      lengths: wavelengths.lengths,
      amplitudes: wavelengths.amplitudes.map((a) => a * factor),
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

export const mergeWavelengths = (
  a: Wavelengths,
  b: Wavelengths,
): Wavelengths => {
  if ("length" in a) {
    if ("length" in b)
      return {
        lengths: [a.length, b.length],
        amplitudes: [a.amplitude, b.amplitude],
      };
    if ("lengths" in b)
      return {
        lengths: [a.length, ...b.lengths],
        amplitudes: [a.amplitude, ...b.amplitudes],
      };
    // cannot integrate with function, assume dwavelength=0 -> NO EFFECT
    return b;
  }
  if ("lengths" in a) {
    if ("length" in b) return mergeWavelengths(b, a);
    if ("lengths" in b) return mergeWavelengths(b, a);
    // cannot integrate with function, assume dwavelength=0 -> NO EFFECT
    return b;
  }
  if ("length" in b) return mergeWavelengths(b, a);
  if ("lengths" in b) return mergeWavelengths(b, a);
  // integrating functions
  return {
    range: [Math.min(...a.range, ...b.range), Math.max(...a.range, ...b.range)],
    amplitude: (l) => {
      const aComponent =
        l < a.range[0] || l >= a.range[1]
          ? 0
          : typeof a.amplitude === "number"
            ? a.amplitude
            : a.amplitude(l);
      const bComponent =
        l < b.range[0] || l >= b.range[1]
          ? 0
          : typeof b.amplitude === "number"
            ? b.amplitude
            : b.amplitude(l);
      return aComponent + bComponent;
    },
  };
};

const MERGE_RAYS = true;

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
  const multipleWavelengths = !("length" in ray.wavelengths);
  const multipleRefractiveIndices =
    typeof pastMaterial.refractiveIndex !== "number" ||
    typeof newMaterial.refractiveIndex !== "number";
  const rays =
    newMaterial.absorption || (multipleWavelengths && multipleRefractiveIndices)
      ? subdivideRay(ray, dwavelength)
      : [ray];
  const newRays: Ray[] = [];
  const reflectedRays: { [key: number]: Ray | undefined } = {};
  const refractedRays: { [key: number]: Ray | undefined } = {};
  for (const ray of rays) {
    const n1 = refractiveIndex(pastMaterial, ray.wavelengths);
    const n2 = refractiveIndex(newMaterial, ray.wavelengths);
    const reflectedAngleVec: vec2 = [
      ray.angle[0] - 2 * incidentDotNormal * normal[0],
      ray.angle[1] - 2 * incidentDotNormal * normal[1],
    ];
    const eta = n1 / n2;
    const normalCoeff =
      eta * incidentDotNormal +
      Math.sqrt(1 - eta * eta * (1 - incidentDotNormal * incidentDotNormal));
    const refractedAngleVec: vec2 = [
      eta * ray.angle[0] - normalCoeff * normal[0],
      eta * ray.angle[1] - normalCoeff * normal[1],
    ];
    const R0 = ((n1 - n2) / (n1 + n2)) ** 2;
    let R = R0 + (1 - R0) * (1 + incidentDotNormal) ** 5;
    let T = 1 - R;
    if (newMaterial.absorption) {
      const coeff = newMaterial.absorption(meanWavelength(ray.wavelengths));
      R *= coeff;
      T *= coeff;
    }
    if (R > 0.1) {
      const wavelengths = amplifyWavelengths(ray.wavelengths, R);
      const h = Math.round(
        Math.atan2(reflectedAngleVec[1], reflectedAngleVec[0]) *
          (180 / Math.PI) *
          1e1,
      );
      if (MERGE_RAYS && reflectedRays[h]) {
        reflectedRays[h].wavelengths = mergeWavelengths(
          reflectedRays[h].wavelengths,
          wavelengths,
        );
      } else {
        reflectedRays[h] = {
          origin: ray.position,
          position: [
            ray.position[0] + 1 * reflectedAngleVec[0],
            ray.position[1] + 1 * reflectedAngleVec[1],
          ],
          wavelengths,
          angle: reflectedAngleVec,
          glass: ray.glass,
          distance: ray.distance + 1,
          transitions: ray.transitions + 1,
        };
        newRays.push(reflectedRays[h]);
      }
    }
    if (T > 0.1) {
      const wavelengths = amplifyWavelengths(ray.wavelengths, T);
      const h = Math.round(
        Math.atan2(refractedAngleVec[1], refractedAngleVec[0]) *
          (180 / Math.PI) *
          1e1,
      );
      if (MERGE_RAYS && refractedRays[h]) {
        refractedRays[h].wavelengths = mergeWavelengths(
          refractedRays[h].wavelengths,
          wavelengths,
        );
      } else {
        refractedRays[h] = {
          origin: ray.position,
          position: [
            ray.position[0] + 1 * refractedAngleVec[0],
            ray.position[1] + 1 * refractedAngleVec[1],
          ],
          wavelengths,
          angle: refractedAngleVec,
          glass: sdfOutput.glass,
          distance: ray.distance + 1,
          transitions: ray.transitions + 1,
        };
        newRays.push(refractedRays[h]);
      }
    }
  }
  return newRays;
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
  if (amplitude <= 0) return [0, 0, 0];
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
  if ("lengths" in wavelengths) {
    const rgb: vec3 = [0, 0, 0];
    for (let i = 0; i < wavelengths.lengths.length; i++) {
      const rgbi = wavelengthToRGB(
        wavelengths.lengths[i],
        wavelengths.amplitudes[i],
      );
      rgb[0] += rgbi[0];
      rgb[1] += rgbi[1];
      rgb[2] += rgbi[2];
    }
    return rgb;
  }
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
