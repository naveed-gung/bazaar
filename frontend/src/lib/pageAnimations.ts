import { AnimationDirection } from "@/components/animation/types";

// Page animation presets with different animation directions and options
export interface AnimationPreset {
  direction: AnimationDirection;
  duration: number;
  delay: number;
  distance: number;
  bounce?: boolean;
  staggerChildren?: boolean;
  staggerDelay?: number;
  springiness?: number;
}

// Shop page animations
export const shopAnimations = {
  header: {
    direction: "down",
    duration: 0.7,
    delay: 0,
    distance: 40,
    bounce: true
  } as AnimationPreset,
  
  filters: {
    direction: "left",
    duration: 0.5,
    delay: 0.1,
    distance: 50
  } as AnimationPreset,
  
  products: {
    direction: "up",
    duration: 0.6,
    delay: 0.2,
    distance: 30,
    staggerChildren: true,
    staggerDelay: 0.05
  } as AnimationPreset,
  
  pagination: {
    direction: "up",
    duration: 0.5,
    delay: 0.4,
    distance: 20
  } as AnimationPreset
};

// About page animations
export const aboutAnimations = {
  hero: {
    direction: "scale",
    duration: 0.8,
    delay: 0,
    distance: 0,
    bounce: true
  } as AnimationPreset,
  
  mission: {
    direction: "left",
    duration: 0.7,
    delay: 0.1,
    distance: 80
  } as AnimationPreset,
  
  team: {
    direction: "up",
    duration: 0.6,
    delay: 0.2,
    distance: 50,
    staggerChildren: true,
    staggerDelay: 0.1
  } as AnimationPreset,
  
  values: {
    direction: "right",
    duration: 0.7,
    delay: 0.1,
    distance: 80
  } as AnimationPreset
};

// Authentication page animations
export const authAnimations = {
  card: {
    direction: "scale",
    duration: 0.7,
    delay: 0.1,
    distance: 0,
    bounce: true
  } as AnimationPreset,
  
  form: {
    direction: "up",
    duration: 0.6,
    delay: 0.3,
    distance: 30,
    staggerChildren: true,
    staggerDelay: 0.08
  } as AnimationPreset,
  
  socialButtons: {
    direction: "up",
    duration: 0.5,
    delay: 0.5,
    distance: 20,
    staggerChildren: true,
    staggerDelay: 0.1
  } as AnimationPreset
};