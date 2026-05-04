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

Deploy the current build to the `gh-pages` branch:

```bash
npx yarn build
npx yarn deploy
```
