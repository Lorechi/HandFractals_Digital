# HandFractal Starten und Bauen

Die eigentliche App liegt direkt in diesem Repository-Ordner.

```powershell
cd C:\Users\Loren\Documents\GitHub\HandFractals-Digital\HandFractals_Digital
```

## Abhaengigkeiten installieren

Das Projekt verwendet Yarn. Falls `yarn` nicht global installiert ist, funktioniert es ueber `npx`:

```powershell
npx yarn install
```

## Lokal starten

```powershell
npx yarn dev
```

Danach im Browser oeffnen:

```text
http://localhost:3000
```

## Statischen Build erstellen

```powershell
npx yarn build
```

Der fertige statische Build wird in diesem Ordner erzeugt:

```text
dist/
```

## Build lokal pruefen

```powershell
npx yarn preview
```

## GitHub Pages

Fuer GitHub Pages muss Vite in `vite.config.ts` den richtigen Base-Pfad kennen.
Dieses Repository heisst `HandFractals_Digital`, deshalb steht dort:

```ts
export default defineConfig({
  base: '/HandFractals_Digital/',
  server: {
    port: 3000
  },
  plugins: [react()],
})
```

Danach erneut bauen:

```powershell
npx yarn build
```

Das Deployment laeuft automatisch ueber GitHub Actions, sobald du nach `main` pushst.

In GitHub muss einmalig eingestellt werden:

1. Repository oeffnen
2. Settings > Pages
3. Source auf `GitHub Actions` stellen

Danach wird die Seite hier erreichbar sein:

```text
https://lorechi.github.io/HandFractals_Digital/
```
