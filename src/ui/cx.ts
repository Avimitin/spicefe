import { extendTailwindMerge } from 'tailwind-merge';

// Adapted from Untitled UI React's utils/cx.ts. Keeping class merging beside
// the vendored primitives prevents callers from accumulating conflicting
// utility classes as variants are composed.
export const cx = extendTailwindMerge({});

