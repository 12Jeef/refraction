import type { Glass } from "./engine/glass";

export type vec2 = [number, number];
export type vec3 = [number, number, number];
export type line = [vec2, vec2];

export type Wavelengths =
  | {
      length: number;
      amplitude: number;
    }
  | {
      lengths: number[];
      amplitudes: number[];
    }
  | {
      range: vec2;
      amplitude: number | ((wavelength: number) => number);
    };

export type Ray = {
  origin: vec2;
  position: vec2;
  angle: vec2;
  wavelengths: Wavelengths;
  glass: Glass | null;
  distance: number;
  transitions: number;
};

export type LightProps = {
  position: vec2;
  wavelengths: Wavelengths;
  amplitude: number;
};
export type PlaneLightProps = LightProps & {
  length: number;
  angle: number;
};
export type PointLightProps = LightProps;
export type DirectionalLightProps = LightProps & {
  angle: number;
  angleSpread: number;
};

export type Material = {
  refractiveIndex: number | ((wavelength: number) => number);
};

export type GlassProps = {
  material?: Material;
};
export type CircleGlassProps = GlassProps & {
  center: vec2;
  radius: number;
};
export type LensGlassProps = GlassProps & {
  center: vec2;
  thickness: number;
  length: number;
  angle: number;
};
export type RectangleGlassProps = GlassProps & {
  center: vec2;
  width: number;
  height: number;
  angle: number;
};
export type PolygonGlassProps = GlassProps & {
  center: vec2;
  vertices: vec2[];
  angle: number;
  knobAngleOffset?: number;
};

export type SDFOutput = {
  distance: number;
  normal: vec2;
};
export type FullSDFOutput = SDFOutput & {
  glass: Glass | null;
  internal: boolean;
};

export type SimulationParams = {
  density: number;
  dwavelength: number;
  maxDistance: number;
  ctx: CanvasRenderingContext2D;
};

export type Line = {
  start: vec2;
  end: vec2;
  rgb: vec3;
};
