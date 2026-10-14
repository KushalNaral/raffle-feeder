---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

## Scope

App shell for Raffle Feeder (index.html + src/). Mode: Operate. Phone-first, works on desktop.

## Task

Owner captures paper raffle tickets (camera / gallery / bulk), confirms OCR-read numbers, keeps them in a wallet, and during the draw keys in a called number to see instantly if it is theirs; marks Called and optionally records the prize won.

## States

Empty wallet; OCR in progress / low confidence / duplicate number; match / not yours on the keypad; called; won with prize note; storage error; import/export.

## Direction contract

THESIS: Your raffle tickets as passes in a wallet. Refuses the category default of a grey list of rows with thumbnails; each ticket is a tactile pass with a perforated stub and a big number, and the draw check is a keypad that lifts the matching pass out of the stack.

OWN-WORLD: Night-event ink-navy ground (dark is picked from the scene: an evening hall, tungsten light, phone in one hand). Passes in a curated set of deep jewel tones (indigo, teal, plum, forest, oxblood) with ivory type, perforation notches and a stub. Saffron is the single accent: actions, focus, and Won. Called carries a mint state. Archivo, with its width axis for wide pass numerals and normal width for the UI. Lucide line icons.

STORY: Owner sees how many tickets they hold, adds more in seconds, and at the draw types the called number and gets MATCH or Not yours instantly, then marks Called or Won.

FIRST VIEWPORT: Top bar with the app name and the add action. Wallet: a stacked pass list with large wide numerals and photo strips. A filter segmented control (All / Called / Won). Bottom tab bar on phone (Wallet, Check) with a saffron Add button. On desktop the Check keypad is docked in a right column.

FORM: Ticket Wallet (third card of the safer hand, after the user steered toward premium). seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
