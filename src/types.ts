import type { Glass } from "./engine/glass";

export type vec2 = [number, number];
export type line = [vec2, vec2];
export type rect = [vec2, vec2];

export type Wavelengths =
  | {
      length: number;
      amplitude: number;
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

export type ChunkSpan = {
  x: vec2;
  y: vec2;
};
export type SDFOutput = {
  distance: number;
  normal: vec2;
};
export type FullSDFOutput = SDFOutput & {
  glass: Glass | null;
};

export type SimulationParams = {
  dwavelength: number;
  size: vec2;
  ctx: CanvasRenderingContext2D;
};

export type Line = {
  start: vec2;
  end: vec2;
  value: number;
};
