# HandFractal Starten und Bauen

Die eigentliche App liegt im Unterordner `HandFractal`.

```powershell
cd C:\Users\Loren\Documents\HandFractal\HandFractal
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
Wenn das GitHub-Repo z. B. `HandFractal` heisst, sollte dort stehen:

```ts
export default defineConfig({
  base: '/HandFractal/',
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

Der Ordner `dist/` ist der Ordner, der fuer statisches Hosting bzw. GitHub Pages deployed werden muss.

Falls mit dem Paket `gh-pages` deployed werden soll:

```powershell
npx gh-pages -d dist
```
