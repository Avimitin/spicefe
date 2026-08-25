# Embla Carousel source record

The welcome-page image carousels use these exact npm packages from
[`davidjerleke/embla-carousel`](https://github.com/davidjerleke/embla-carousel/tree/v8.6.0):

- `embla-carousel@8.6.0`
  - npm integrity: `sha512-SjWyZBHJPbqxHOzckOfo8lHisEaJWmwd23XppYFYVh10bU66/Pn5tkVkbkCMZVdbUE5eTCI2nD8OyIP4Z+uwkA==`
- `embla-carousel-react@8.6.0`
  - npm integrity: `sha512-0/PjqU7geVmo6F734pmPqpyHqiM99olvyecY7zdweCw+6tKEXnrE90pBiBbMMU8s5tICemzpQ3hi5EpxzGW+JA==`
- `embla-carousel-reactive-utils@8.6.0`
  - npm integrity: `sha512-fMVUDUEx0/uIEDM0Mz3dHznDhfX+znCCDCeIophYb1QGVM7YThSWX+wz11zlYwWFOr74b4QLGg0hrGPJeG2s4A==`

`package-lock.json` pins every archive and its integrity metadata. Nix fetches
the packages with lifecycle scripts disabled, and `flake.nix` independently
pins and verifies the upstream license. `src/ui/carousel.tsx` adapts the
open-source Untitled UI React carousel primitive while Embla supplies drag,
snap, and keyboard-state behavior. No carousel code or asset is loaded from a
CDN at runtime.

All three packages are licensed under the MIT License, Copyright (c) David
Jerleke. The complete shared license is reproduced in `LICENSE.MIT.txt`.
