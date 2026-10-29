import { useEffect, useState } from "react";

// Matches --bh-ease-out in index.css: fast start, long soft settle.
const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";

const REVEAL_STEP_MS = 30;
const REVEAL_MAX_STEPS = 6;
const REVEAL_BASE_DELAY_MS = 0;

export function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Keeps a value rendered for `exitMs` after it goes falsy, so the element can
 * play an exit animation instead of vanishing. Returns [shown, isLeaving].
 * A new value arriving mid-exit cancels the exit and takes over immediately.
 */
export function usePresence(value, exitMs) {
  const [shown, setShown] = useState(value);
  if (value && value !== shown) setShown(value);

  const isLeaving = !value && shown != null;

  useEffect(() => {
    if (!isLeaving) return undefined;
    const timer = setTimeout(() => setShown(null), prefersReducedMotion() ? 0 : exitMs);
    return () => clearTimeout(timer);
  }, [isLeaving, exitMs]);

  return [isLeaving ? shown : value, isLeaving];
}

/**
 * Cascades the content blocks of `root` in one after another. Walks down
 * through single-child wrappers until it reaches the level where the view
 * actually lays out its sections, so it works on any view without markup
 * changes. Uses fill "backwards" so nothing is left transformed afterwards —
 * a lingering transform would trap fixed-position descendants.
 */
export function revealBlocks(root) {
  if (!root || prefersReducedMotion()) return [];

  let level = root;
  while (level.children.length === 1) level = level.children[0];

  return Array.from(level.children).map((block, index) =>
    block.animate(
      [
        { opacity: 0, transform: "translateY(10px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration: 380,
        delay: REVEAL_BASE_DELAY_MS + Math.min(index, REVEAL_MAX_STEPS) * REVEAL_STEP_MS,
        easing: EASE_OUT,
        fill: "backwards",
      }
    )
  );
}
