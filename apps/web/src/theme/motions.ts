import type { CSSProperties } from 'react';
import type { ThemePart } from './part';

// SHEET-05: the app's animations are a fixed list of presets (ADR 015 item 8). A skin sets a
// preset's settings, its speed and its size, through the keys `motion-<preset>-duration` and
// `motion-<preset>-size`; it cannot write a motion of its own. Each preset moves only what a phone
// draws cheaply: position, size, opacity (item 9). The loops' keyframes are in motion.css.
// While the phone asks for reduced motion, or the app's switch is on, every preset is `none`: a
// transition jumps to its end, a loop stands still.
interface Transition {
  kind: 'transition';
  // The property that moves, and the easing; neither is a skin's setting.
  property: 'transform' | 'opacity';
  easing: string;
  duration: string;
}

interface Loop {
  kind: 'loop';
  easing: string;
  direction: 'normal' | 'alternate';
  duration: string;
  // How far it goes: the lowest opacity, a distance. A loop with no size has no such setting.
  size?: string;
}

export const motionPresets = {
  // The boards' one motion: the step's chevron turns (V3-Create, V3-Conflict).
  turn: { kind: 'transition', property: 'transform', easing: 'ease', duration: '200ms' },
  pulse: {
    kind: 'loop',
    easing: 'ease-in-out',
    direction: 'alternate',
    duration: '2s',
    size: '0.6',
  },
  float: {
    kind: 'loop',
    easing: 'ease-in-out',
    direction: 'alternate',
    duration: '3s',
    size: '4px',
  },
  spin: { kind: 'loop', easing: 'linear', direction: 'normal', duration: '8s' },
} as const satisfies Record<string, Transition | Loop>;

export type MotionName = keyof typeof motionPresets;

const token = (key: string) => `var(--theme-${key})`;

// The theme keys the presets fill: their settings, and the value an element wears, built from them.
export function motionTheme(): ThemePart {
  const shared: Record<string, string> = {};
  const still: Record<string, string> = {};
  for (const [name, preset] of Object.entries(motionPresets) as [MotionName, Transition | Loop][]) {
    const duration = token(`motion-${name}-duration`);
    shared[`motion-${name}-duration`] = preset.duration;
    if (preset.kind === 'transition') {
      shared[`motion-${name}`] = `${preset.property} ${duration} ${preset.easing}`;
    } else {
      if (preset.size !== undefined) shared[`motion-${name}-size`] = preset.size;
      shared[`motion-${name}`] =
        `motion-${name} ${duration} ${preset.easing} infinite ${preset.direction}`;
    }
    still[`motion-${name}`] = 'none';
  }
  return { shared, still };
}

export const motion = motionTheme();

// The app's switch writes this on <html>; SHEET-13 shows the switch and keeps the choice.
export const STILL_SELECTOR = ":root[data-motion='still']";

export function setMotionStill(still: boolean, doc: Document = document): void {
  if (still) doc.documentElement.dataset.motion = 'still';
  else delete doc.documentElement.dataset.motion;
}

// Whether motion is stopped now, for what CSS cannot stop: an animated picture or a video shows
// a still frame instead.
export function motionIsStill(win: Window = window): boolean {
  return (
    win.document.documentElement.dataset.motion === 'still' ||
    win.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// The style an element wears for a preset: a transition or an animation, read from its theme key.
export function motionStyle(name: MotionName): CSSProperties {
  const value = token(`motion-${name}`);
  return motionPresets[name].kind === 'transition' ? { transition: value } : { animation: value };
}

// A loop pauses while its element is off screen or the app is in the background (ADR 015 item 9):
// the element gets `data-motion-paused`, which motion.css turns into a paused animation.
export function watchOnScreen(
  el: Element,
  win: { IntersectionObserver: typeof IntersectionObserver } = window,
): () => void {
  const doc = el.ownerDocument;
  let onScreen = true;
  const report = () =>
    el.toggleAttribute('data-motion-paused', !onScreen || doc.visibilityState === 'hidden');
  const observer = new win.IntersectionObserver((entries) => {
    for (const entry of entries) onScreen = entry.isIntersecting;
    report();
  });
  observer.observe(el);
  doc.addEventListener('visibilitychange', report);
  report();
  return () => {
    observer.disconnect();
    doc.removeEventListener('visibilitychange', report);
  };
}
