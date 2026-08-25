# React source record

The production bundle contains these exact npm packages from the official
React project:

- `react@19.2.8`
  - source: https://github.com/facebook/react/tree/v19.2.8/packages/react
  - npm integrity: `sha512-PWaYA1L/q9u2u7xYQi+Y3L3Yfnie7XyLeaJICV1MGD6LprsBxcAqGjYyr0eY3p+QdsA+x/Irkt4Qif8D63+Sbw==`
- `react-dom@19.2.8`
  - source: https://github.com/facebook/react/tree/v19.2.8/packages/react-dom
  - npm integrity: `sha512-rVprimfGBG3DR+Tq0IQG2DT5PxKth1WIGDmj5yPmlzr4YBe7uyE+Du4oVqTDXZSHGGGXRtTJEGSSePyQCMBglQ==`
- `scheduler@0.27.0`
  - source: https://github.com/facebook/react/tree/v19.2.8/packages/scheduler
  - npm integrity: `sha512-eNv+WrVbKu1f3vbYJT/xtiF5syA5HPIMtf9IgY/nKg0sWqzAUEvqY/xm7OcZc/qafLx/iO9FgOmeSAp4v5ti/Q==`

All three packages are licensed under the MIT License, Copyright (c) Meta
Platforms, Inc. and affiliates. The complete shared license is in
`LICENSE.MIT.txt`. `package-lock.json` pins the package archives and integrity
metadata; Nix fetches them with install scripts disabled and uses Nixpkgs'
esbuild executable to produce `public/app.js`.
