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
- `use-sync-external-store@1.6.0`
  - source: https://github.com/facebook/react/tree/main/packages/use-sync-external-store
  - npm integrity: `sha512-Pp6GSwGP/NrPIrxVFAIkOQeyw8lFenOHijQWkUTrDvrF4ALqylP2C/KCkeS9dpUM3KvYRQhna5vt7IL95+ZQ9w==`
- `client-only@0.0.1`
  - homepage: https://react.dev/
  - npm integrity: `sha512-IV3Ou0jSMzZrd3pZ48nLkT9DA7Ag1pnPzaiQhpW7c3RbcqqzvzzVu+L8gfqMp/8IM2MQtSiqaCxrrcfu8I8rMA==`

These packages are licensed under the MIT License. React, React DOM, Scheduler,
and use-sync-external-store use the shared license Copyright (c) Meta Platforms,
Inc. and affiliates reproduced in `LICENSE.MIT.txt`; `client-only` declares the
same license in its package metadata and contains only the client marker.
`package-lock.json` pins the package archives and integrity metadata; Nix
fetches them with install scripts disabled and uses Nixpkgs' esbuild executable
to produce `public/app.js`.
