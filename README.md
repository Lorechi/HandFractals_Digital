# HandFractal

A Vite + React camera experiment that uses MediaPipe Hands and renders recursive hand shapes on a canvas.

## Requirements

- Node.js 20 or newer
- Yarn 1.x

If Yarn is not installed globally, run the commands with `npx yarn`.

## Getting Started

Install dependencies:

```bash
npx yarn install
```

Start the local dev server:

```bash
npx yarn dev
```

Open http://localhost:3000 in your browser and allow camera access.

## Static Build

Create a production build:

```bash
npx yarn build
```

Preview the production build locally:

```bash
npx yarn preview
```

Vite writes the static site to `dist/`.

## Deploy

This repo deploys automatically to GitHub Pages with GitHub Actions.

1. In GitHub, open this repository's **Settings > Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to the `main` branch.

The site will be published at:

```text
https://lorechi.github.io/HandFractals_Digital/
```

To check the same production build locally:

```bash
npx yarn build
npx yarn preview
```
