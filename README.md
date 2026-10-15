# Raffle Feeder

Raffle Feeder keeps your paper raffle tickets in a phone wallet. Photograph your tickets, confirm each number, and when numbers are called at the draw, key one in to see straight away whether it's yours.

**Live app:** https://kushalnaral.github.io/raffle-feeder/

## Features

- **Add tickets** with the + button, which opens your phone's camera or gallery, including many photos at once (on desktop you can also drag and drop).
- **Finds the number by itself**: on-device OCR locates the ticket in the photo, finds the handwritten or printed number on it and reads it. There's nothing to mark. Sideways and slightly tilted photos are handled too, and the spot it read is outlined so you can confirm or correct the number.
- **Wallet**: tickets appear as stacked passes, filtered by All, Called or Won.
- **Check**: a big keypad for the draw, and where the app opens once you have tickets. It shows *It's yours!* when the number matches and marks that ticket as called, or *Not this time* when it doesn't. Just type the next number over the last one. It keeps a list of the numbers you've checked.
- **Marking**: mark a ticket as Called, and note the prize if you won one.
- **Privacy**: everything is stored in your browser (IndexedDB) and nothing is uploaded. You can export or import a backup file from Settings.
- **Offline**: the app is installable as a PWA and works offline once it has loaded. The OCR engine is self-hosted.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173/
npm run typecheck  # strict TypeScript
npm test           # Vitest + Testing Library
npm run build      # typechecks, then builds
```

The app is strict TypeScript (`tsconfig.json`). Tests sit next to the code they cover (`*.test.ts(x)`) and run in jsdom with an in-memory IndexedDB. CI runs typecheck, tests and build on every pull request, and the deploy workflow won't publish if any of them fail.

## Deploy

It's a static Vite app. Any of these hosts works for free:

- **Vercel / Netlify / Cloudflare Pages:** import the repo. Build command `npm run build`, output folder `dist`.
- **GitHub Pages:** `.github/workflows/deploy.yml` deploys on every push to `main`. In Settings → Pages, set Source to **GitHub Actions**.
