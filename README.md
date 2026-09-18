# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  # 2dai

  A local-first recurring task planner built with React, Vite, TypeScript, and Dexie.

  ## Development

  ```sh
  npm install
  npm run dev
  ```

  ## Tests

  Vitest covers the pure domain and import logic. Playwright covers critical workflows in desktop and mobile Chromium using a managed Vite server and isolated browser contexts.

  ```sh
  npm test                 # Run unit tests once
  npm run test:watch       # Run unit tests in watch mode
  npm run test:coverage    # Run unit tests with enforced coverage
  npm run test:e2e         # Run Playwright functional tests
  npm run test:all         # Run coverage and functional suites
  ```

  Install the Playwright browser once on a new machine:

  ```sh
  npx playwright install chromium
  ```

  Coverage reports are written to `coverage/`, with an HTML report at `coverage/index.html`. The build fails if global statements, branches, functions, or lines coverage drops below 85% for the instrumented modules configured in `vitest.config.ts`.

  Playwright failure artifacts are written to `test-results/`. The HTML report is written to `playwright-report/` and can be opened with:

  ```sh
  npx playwright show-report
  ```

  ## Quality Checks

  ```sh
  npm run build
  npm run lint
  ```
      reactDom.configs.recommended,
