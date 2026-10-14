# Raffle Feeder

Raffle Feeder keeps your paper raffle tickets in a phone wallet. Photograph your tickets, confirm each number, and when numbers are called at the draw, key one in to see straight away whether it's yours.

**Live app:** https://kushalnaral.github.io/raffle-feeder/

## Features

- **Add tickets** from the camera, the gallery, or many photos at once (on desktop you can also drag and drop).
- **On-device OCR** reads the ticket number. Handwritten numbers read best when you drag a box over the number on one photo. The app remembers that spot and uses it for the rest of the batch. You always confirm or correct the number.
- **Wallet**: tickets appear as stacked passes, filtered by All, Called or Won.
- **Check**: a big keypad for the draw. It shows *It's yours!* when the number matches, *Not yours* when it doesn't, and keeps a list of the numbers you've checked.
- **Marking**: mark a ticket as Called, and note the prize if you won one.
- **Privacy**: everything is stored in your browser (IndexedDB) and nothing is uploaded. You can export or import a backup file from Settings.
- **Offline**: the app is installable as a PWA and works offline once it has loaded. The OCR engine is self-hosted.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173/raffle-feeder/
npm run build
```

Every push to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`. In the repo, under Settings → Pages, set Source to **GitHub Actions**.
