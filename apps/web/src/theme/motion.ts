import type { ThemePart } from './part';

// SHEET-05: animations are the app's presets with settings (ADR 015 item 8). A screen draws one
// with <Motion preset>; motion.css holds each preset's keyframes, which read the theme keys
// `motion-<preset>-<setting>`. A skin fills the same keys and cannot add a preset. The phone's
// "reduce motion", the app's switch, an element off screen and the app in the background stop
// them (item 9).
export const motionSettings = {
  pulse: ['duration', 'scale'],
  float: ['duration', 'distance'],
  glow: ['duration', 'size', 'color'],
  sparkle: ['duration', 'size', 'color'],
  'gradient-shift': ['duration', 'from', 'to'],
} as const satisfies Record<string, readonly string[]>;

export type MotionPreset = keyof typeof motionSettings;

// The base theme puts no preset on a screen; these are what a preset shows when one does. The
// default transition is the boards' one motion, `transition: transform 0.2s ease`.
export const motion = {
  shared: {
    'default-transition-duration': '0.2s',
    'default-transition-timing-function': 'ease',
    'motion-pulse-duration': '2s',
    'motion-pulse-scale': '1.06',
    'motion-float-duration': '3s',
    'motion-float-distance': '4px',
    'motion-glow-duration': '2s',
    'motion-glow-size': '12px',
    'motion-glow-color': 'var(--theme-color-strong)',
    'motion-sparkle-duration': '1.6s',
    'motion-sparkle-size': '3px',
    'motion-sparkle-color': 'var(--theme-color-strong)',
    'motion-gradient-shift-duration': '8s',
    'motion-gradient-shift-from': 'var(--theme-color-surface)',
    'motion-gradient-shift-to': 'var(--theme-color-soft)',
  },
} satisfies ThemePart;

// The app's own switch (shown by SHEET-13): off, every animation is a still picture, as with the
// phone's "reduce motion".
export function setAppMotion(on: boolean, doc: Document = document): void {
  doc.documentElement.classList.toggle('motion-off', !on);
}

// Presets pause while the app is in the background. Returns the function that stops watching.
export function pauseInBackground(doc: Document = document): () => void {
  const update = () =>
    doc.documentElement.classList.toggle('app-hidden', doc.visibilityState === 'hidden');
  update();
  doc.addEventListener('visibilitychange', update);
  return () => doc.removeEventListener('visibilitychange', update);
}

// A preset pauses while its element is off screen. Returns the function that stops watching.
export function pauseOffScreen(
  element: Element,
  Observer: typeof IntersectionObserver | undefined = globalThis.IntersectionObserver,
): () => void {
  if (!Observer) return () => {};
  const observer = new Observer((entries) => {
    const entry = entries.at(-1);
    if (entry) element.toggleAttribute('data-motion-paused', !entry.isIntersecting);
  });
  observer.observe(element);
  return () => observer.disconnect();
}
