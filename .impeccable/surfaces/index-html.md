---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

## Scope

App shell for Raffle Feeder (index.html + src/). Mode: Operate. Phone-first, works on desktop. Redesign: replaces the "Ticket Wallet" world, which the user rejected as not fun enough.

## Task

Owner captures paper raffle tickets (camera / gallery / bulk), confirms OCR-read numbers, keeps them in a wallet, and during the draw keys in a called number to see instantly if it is theirs; marks Called and optionally records the prize won.

## States

Empty wallet; OCR in progress / low confidence / duplicate number; match / not yours on the keypad; called; won with prize note; storage error; import/export.

## Direction contract

THESIS: Every ticket is an instant scratch card. Refuses grey list rows and the premium-wallet look. A ticket's status is a holographic foil panel that gets scratched off when its number is called, and the check screen is one big scratch card you key a number into.

OWN-WORLD: Deep night-violet ground with a faint confetti-dot texture. The cards are punchy printed card stock in hot coral, cobalt, acid lime, tangerine and bubblegum, each with its own ink colour. Holographic silver foil is a real material: a conic pastel sheen with sparkle grain. Bricolage Grotesque: condensed weight 800 for the big numerals and the wordmark, normal width for the UI. Chunky candy keys with depth. Lucide icons.

STORY: Owner sees their tickets as a colourful deck, adds more in seconds, and at the draw keys in the number. The foil scratches itself off to reveal IT'S YOURS (with confetti) or NOT THIS TIME, and one tap marks it Called or Won.

FIRST VIEWPORT: Wordmark top-left and settings top-right. Filter chips (All / Called / Won). A two-column grid of scratch cards: big number, photo inset, and a foil status strip. Bottom tab bar on phone (Tickets, Check) with a raised coral Add button. On desktop the Check card and keypad are docked on the right and fit the viewport.

FORM: Scratch Card (the user's pick from a grounded re-roll; the bolder register was unavailable because the roll ran degraded). seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
