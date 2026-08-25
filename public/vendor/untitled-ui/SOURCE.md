# Untitled UI React source record

spicefe vendors and adapts the free, open-source React components from
[`untitleduico/react`](https://github.com/untitleduico/react) at commit
`d29a2adf6909e5aaeb234bccf82dcffeb67fdb2e`. The same revision is pinned as a
non-flake Nix input so the build checks this license against upstream.

The local component foundation derives from these upstream files:

- `src/ui/button.tsx` — `components/base/buttons/button.tsx`
- `src/ui/checkbox.tsx` — `components/base/checkbox/checkbox.tsx`
- `src/ui/status-badge.tsx` — `components/base/badges/badges.tsx`
- `src/ui/cx.ts` — `utils/cx.ts`
- the e-amusement card variants —
  `components/shared-assets/credit-card/credit-card.tsx`

Variants, sizes, tokens, and dependencies are narrowed to what spicefe uses.
The resulting source is compiled locally with the Nix-provided Tailwind CSS
4.3.3 executable. React Aria Components and `tailwind-merge` are independently
version-locked npm source dependencies with their own notices and licenses.

The referenced Untitled UI source is licensed under the MIT License. See
`LICENSE.MIT.txt` in this directory. Untitled UI PRO source, assets, and
examples are not included.
