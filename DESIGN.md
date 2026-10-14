---
name: Raffle Feeder
description: Paper raffle tickets turned into a deck of instant scratch cards you check at the draw.
colors:
  night-violet: "oklch(0.2 0.075 295)"
  night-violet-raised: "oklch(0.245 0.085 295)"
  plum-surface: "oklch(0.3 0.09 295)"
  plum-surface-hi: "oklch(0.355 0.1 295)"
  plum-line: "oklch(0.41 0.085 295)"
  chalk-ink: "oklch(0.985 0.008 300)"
  lilac-ink: "oklch(0.87 0.04 300)"
  dusk-ink: "oklch(0.75 0.06 300)"
  card-ink: "oklch(0.2 0.07 295)"
  hot-coral: "oklch(0.72 0.19 30)"
  hot-coral-hi: "oklch(0.77 0.17 34)"
  cobalt: "oklch(0.56 0.21 266)"
  acid-lime: "oklch(0.91 0.19 124)"
  tangerine: "oklch(0.81 0.15 66)"
  bubblegum: "oklch(0.81 0.12 350)"
  mint: "oklch(0.87 0.13 172)"
  danger-red: "oklch(0.68 0.2 22)"
  foil-flat: "#dfe2ec"
typography:
  display:
    fontFamily: "'Bricolage Grotesque Variable', system-ui, -apple-system, 'Segoe UI', 'Noto Sans Devanagari', sans-serif"
    fontSize: "clamp(56px, min(22vw, 10dvh), 104px)"
    fontWeight: 800
    lineHeight: 0.9
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 75"
  headline:
    fontFamily: "'Bricolage Grotesque Variable', system-ui, -apple-system, 'Segoe UI', 'Noto Sans Devanagari', sans-serif"
    fontSize: "clamp(38px, 12vw, 52px)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 75"
  title:
    fontFamily: "'Bricolage Grotesque Variable', system-ui, -apple-system, 'Segoe UI', 'Noto Sans Devanagari', sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 78"
  body:
    fontFamily: "'Bricolage Grotesque Variable', system-ui, -apple-system, 'Segoe UI', 'Noto Sans Devanagari', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "'tnum'"
  label:
    fontFamily: "'Bricolage Grotesque Variable', system-ui, -apple-system, 'Segoe UI', 'Noto Sans Devanagari', sans-serif"
    fontSize: "13px"
    fontWeight: 800
    letterSpacing: "0.02em"
    fontVariation: "'wdth' 85"
rounded:
  strip: "12px"
  photo: "14px"
  field: "16px"
  key: "20px"
  tile: "22px"
  card: "24px"
  sheet: "30px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "10px"
  md: "14px"
  lg: "18px"
  xl: "22px"
  gutter: "16px"
components:
  button-primary:
    backgroundColor: "{colors.hot-coral}"
    textColor: "{colors.card-ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "50px"
  button-primary-hover:
    backgroundColor: "{colors.hot-coral-hi}"
  button-win:
    backgroundColor: "{colors.acid-lime}"
    textColor: "{colors.card-ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "50px"
  button-mint:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.card-ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "50px"
  button-quiet:
    backgroundColor: "{colors.plum-surface}"
    textColor: "{colors.chalk-ink}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "50px"
  button-quiet-hover:
    backgroundColor: "{colors.plum-surface-hi}"
  chip-filter:
    backgroundColor: "{colors.night-violet-raised}"
    textColor: "{colors.lilac-ink}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  chip-filter-on:
    backgroundColor: "{colors.chalk-ink}"
    textColor: "{colors.card-ink}"
  input-text:
    backgroundColor: "{colors.night-violet-raised}"
    textColor: "{colors.chalk-ink}"
    rounded: "{rounded.field}"
    padding: "0 16px"
    height: "54px"
  scratch-card:
    textColor: "{colors.card-ink}"
    rounded: "{rounded.card}"
    padding: "14px 14px 16px"
    typography: "{typography.headline}"
  keypad-key:
    backgroundColor: "{colors.plum-surface}"
    textColor: "{colors.chalk-ink}"
    rounded: "{rounded.key}"
    height: "clamp(46px, 6.6dvh, 66px)"
  keypad-key-active:
    backgroundColor: "{colors.plum-surface-hi}"
  tab-add:
    backgroundColor: "{colors.hot-coral}"
    textColor: "{colors.card-ink}"
    rounded: "{rounded.card}"
    size: "66px"
  toast:
    backgroundColor: "{colors.acid-lime}"
    textColor: "{colors.card-ink}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
---

# Design System: Raffle Feeder

## Overview

**Creative North Star: "The Instant Scratch Card"**

Every ticket is a punchy, printed scratch card dealt onto a deep night-violet table. The ground is dark, quiet and dotted with faint confetti; everything the owner touches is loud card stock in hot coral, cobalt, acid lime, tangerine or bubblegum, each with its own ink. The one real material is holographic silver foil: a pastel conic-style sheen with sparkle grain that covers what is still unknown and gets scratched away when a number is called.

The system is built for a crowded hall and one hand. Numbers are huge, condensed and tabular; targets are fat and pill-shaped or candy-chunky; depth is a bevel you can press. Motion is playful but short: things pop, deal and spring back, and then sit still so a number can be read at arm's length.

Grey list rows and the premium-wallet look are rejected for this world: tickets are never rendered as quiet table rows or as sober leather-and-gold wallet passes.

**Key Characteristics:**
- Dark night-violet ground with a 26px confetti-dot pattern; colour lives on the cards, not the chrome.
- Five card-stock tones assigned per ticket number, each paired with its own ink.
- Holographic foil as the status material: pending is foil, called and won are the foil scratched off.
- Bricolage Grotesque throughout; condensed weight 800 for numerals and the wordmark, normal width for UI copy.
- Candy depth: inset top highlight plus inset bottom bevel that compresses on press.
- Springy overshoot on small press and pop interactions only.

## Colors

A dark violet stage for saturated, printed card-stock colours and one silver foil.

### Primary
- **Hot Coral** (`hot-coral`): the action colour. Primary buttons, the raised Add button in the tab bar, the first add-option icon tile, and one of the five card tones. Hover lifts to **Hot Coral Bright** (`hot-coral-hi`).

### Secondary
- **Acid Lime** (`acid-lime`): the "yours / winner" signal and the focus colour. Focus rings, the active tab, the IT'S YOURS reveal text, winning log chips, the win button, toasts, text selection and the caret.
- **Mint** (`mint`): the "called" signal. The called strip text, the Mark called button, switch-on state and the privacy icon.

### Tertiary
- **Cobalt, Tangerine, Bubblegum** (`cobalt`, `tangerine`, `bubblegum`): card-stock tones that, with coral and lime, make up the five-tone deck. Tangerine also carries inline warnings (duplicate / low-confidence numbers). Cobalt is the only tone that takes light ink.
- **Danger Red** (`danger-red`): destructive actions only (delete, clear).

### Neutral
- **Night Violet** (`night-violet`): page ground, sticky top bar.
- **Night Violet Raised** (`night-violet-raised`): sheets, inputs, filter chips, match rows.
- **Plum Surface** / **Plum Surface High** (`plum-surface`, `plum-surface-hi`): quiet buttons, keypad keys, add/setting tiles, banners; the high step is their hover/pressed state.
- **Plum Line** (`plum-line`): 2px borders, dashed dividers, switch-off track.
- **Chalk Ink** (`chalk-ink`): primary text on the dark ground; selected chip fill.
- **Lilac Ink** (`lilac-ink`): secondary text, labels, icon buttons.
- **Dusk Ink** (`dusk-ink`): tertiary text, counts, placeholders, inactive tabs.
- **Card Ink** (`card-ink`): text printed on light card stock and on lime/coral/mint buttons; also the dark window of the reveal panel and the called/won strips.
- **Foil Silver** (`foil-flat`): flat stand-in for the foil where a gradient can't go (the wordmark mark).

The live foil is a gradient token, not a flat colour: `linear-gradient(115deg, #c9ccd8 0%, #f4c9ec 22%, #c3edf7 44%, #e7f7c0 64%, #f6dcc0 82%, #cfd2de 100%)` with a 120px fractal-noise sparkle grain over it, drifting with a slow 6s sheen.

### Named Rules
**The Colour Lives On The Card Rule.** Saturated tones belong to cards, the Add button, and status signals. Chrome (top bar, sheets, chips, keypad) stays in the violet neutrals.

**The Tone Carries Its Ink Rule.** A card tone is always set as a pair: background tone plus its ink (card ink on coral, lime, tangerine, bubblegum; chalk ink on cobalt). Never put text on a tone without its paired ink.

**The Two Signals Rule.** Lime means yours / won; mint means called. Do not swap them or use either decoratively on the ground.

## Typography

**Display Font:** Bricolage Grotesque Variable (with system-ui, Segoe UI, Noto Sans Devanagari fallbacks)
**Body Font:** Bricolage Grotesque Variable (same stack)

**Character:** One variable family doing two jobs: squeezed to 75-85% width at weight 800 it becomes a ticket-stub numeral and a shouty wordmark; at normal width it is a friendly, slightly quirky UI voice. Tabular numerals are on globally so numbers line up and don't jitter.

### Hierarchy
- **Display** (800, `clamp(56px, min(22vw, 10dvh), 104px)`, 0.9, width 75%): the called number typed into the check card. One per screen.
- **Headline** (800, `clamp(38px, 12vw, 52px)`, 0.95, width 75%): the ticket number on each scratch card; 72px on the ticket detail hero.
- **Title** (800, 28px, 1.05, width 78%): sheet titles; the empty-state headline steps up to 36px and the wordmark sits at 24px on the same settings.
- **Body** (400-500, 16px, 1.45): UI copy; 17px for lead copy in empty states, capped at 34ch.
- **Label** (800, 13px, 0.02em, width 85%, uppercase): foil and status strip text. Small UI labels (field labels, tab labels, helper text) use 13-15px at weight 600-700 without uppercase.

### Named Rules
**The Squeezed Numeral Rule.** Every ticket number, called number and key cap is weight 800 at reduced width (75-85%). Width does the shouting; never add size beyond the clamps to make a number louder.

**The Uppercase Is Foil Rule.** Uppercase is reserved for text printed on a strip or the reveal panel (DRAW PENDING, CALLED, IT'S YOURS). UI copy stays sentence case.

## Layout

Phone-first, single column inside a 560px main column with a 16px side gutter. The wallet is a two-column deck (14px gap; 10px under 380px). A floating tab bar (68px tall, inset 12px from the edges and 10px from the bottom, safe-area aware) holds Tickets, a raised Add button and Check. The Check view fills the viewport height: check card on top, a scrolling result area, and the keypad pinned to the bottom.

When the layout goes wide the main area becomes a 1240px grid of `minmax(0, 1fr) 420px` with a 40px gap: the deck auto-fills 200px-minimum cards on the left, and the Check card plus keypad dock sticky on the right, sized to the viewport (max 860px). The tab bar disappears and Add moves into the top bar. Sheets are bottom sheets on phone and centred dialogs (540px, 880px wide variant) from 720px.

Spacing runs on a tight 8-22px rhythm (8, 10, 14, 18, 22) with 16px gutters; larger gaps only appear between major regions.

## Elevation & Depth

Depth is tactile, not atmospheric. Cards and keys are lit like printed stock and candy: an inset highlight on the top edge and an inset darker bevel on the bottom edge. Pressing compresses the bevel and moves the element down. Above that, soft violet-tinted drop shadows lift cards, the check card, the tab bar, sheets and toasts off the ground. The ground itself is flat apart from its dot texture.

### Shadow Vocabulary
- **Card bevel** (`inset 0 2px 0 oklch(1 0 0 / 0.28), inset 0 -4px 0 oklch(0 0 0 / 0.14)`): scratch cards.
- **Key bevel** (`inset 0 2px 0 oklch(1 0 0 / 0.1), inset 0 -5px 0 oklch(0.14 0.06 295 / 0.55)`; pressed `-2px`): keypad keys.
- **Button bevel** (`inset 0 -3px 0 oklch(0 0 0 / 0.18)`; pressed `-1px`): all filled buttons.
- **Deck lift** (`drop-shadow(0 10px 18px oklch(0.08 0.06 295 / 0.5))`): applied as a filter on each card wrapper so it follows the perforated edge.
- **Float** (`0 14px 34px oklch(0.06 0.05 295 / 0.6)`): tab bar; sheets use `0 -12px 40px` upward.

### Named Rules
**The Press-The-Bevel Rule.** Anything chunky that can be pressed shows a bottom bevel at rest and loses most of it on `:active`, with a 1-3px downward move. Flat elements (chips, icon buttons, fields) don't fake one.

## Shapes

Everything is rounded and soft; nothing has a sharp corner. Buttons, chips and toasts are full pills (999px). Cards use a 24px radius (28px for the larger check card, 30px for sheets), keypad keys 20px, tiles 22px, fields 16px, photo insets 14px, strips 12px. Scratch cards carry a torn perforated top edge (a 5px-radius scallop every 16px, cut with a mask) like a stub pulled off a roll. Borders, where used, are 2px in plum line; dashed 2px lines divide review items and the danger zone. The Add button and the empty-state card sit slightly rotated (-6deg, -5deg) as if tossed on the table.

## Components

### Buttons
Chunky, candy-like, confident.
- **Shape:** full pill (999px), 50px tall (58px large), weight 700, 16px.
- **Primary:** hot coral with card ink; hover goes to coral bright.
- **Win / Mint:** acid lime or mint with card ink for Won and Mark called.
- **Quiet:** plum surface with chalk ink; hover to plum surface high.
- **Danger:** danger red fill; a ghost danger variant is text-only with a red-tinted hover wash.
- **Hover / Active:** hover lifts 1px; active drops 1px, scales to 0.97 and compresses the bevel, on the spring easing.
- **Icon buttons:** 44px square, 14px radius, lilac ink, plum surface on hover; a translucent dark scrim variant sits on photos.

### Chips
- **Filter chips:** 40px pills, 2px plum line border on raised violet, lilac ink, weight 700 with a dimmed count. Selected chip inverts to chalk fill with card ink. Press scales to 0.95.
- **Log chips:** 38px pills of past called numbers, struck through; a hit becomes a solid lime chip.

### Cards / Containers
- **Scratch card:** 24px radius, tone background with soft-light noise grain, perforated top edge, card bevel plus deck lift. Stack: squeezed number, 16:10 photo inset (14px radius), status strip. Hover lifts 4px and tilts -0.8deg; active scales 0.97.
- **Sheets:** raised violet, 2px plum line border, 30px top radius on phone; 22px inner padding; footer split by a 2px border.
- **Tiles (add options, settings):** 80px tall plum surface rows with a 22px radius and a 52px coloured icon square; hover lifts 2px.

### Inputs / Fields
- **Style:** 54px tall, 16px radius, 2px plum line border on raised violet, 17px weight 500 text, dusk ink placeholder.
- **Number field:** 70px tall with a 40px squeezed weight-800 numeral.
- **Focus:** border turns acid lime (fields); everything else gets a 3px lime outline offset 3px.
- **Switch:** 58x36 pill, plum line track turning mint when on, thumb springs across.

### Navigation
- **Tab bar:** floating 68px bar, 26px radius, 2px plum line border, float shadow. Tabs are Lucide icon over a 13px weight-700 label in dusk ink; the active tab turns lime.
- **Add button:** 66px coral square-ish (24px radius) raised 30px above the bar, rotated -6deg, ringed by a 6px ground-coloured halo; hover straightens and grows to 1.04, press shrinks to 0.93.
- **Top bar:** sticky, ground-coloured, wordmark plus foil-card mark on the left, settings on the right.

### Foil Status Strip (signature)
38px strip at the base of every card (44px on the hero). Pending: the holographic foil gradient plus sparkle grain, slowly sheening, with uppercase dark-violet label. Called: card ink panel with mint text and a check icon. Won: card ink panel with lime text, a trophy icon and the prize.

### Check Card and Scratch Reveal (signature)
One big scratch card: the tone switches to the matched ticket's tone on a hit (plum surface otherwise), with the called number in Display type. Under it, a card-ink reveal window is covered by a canvas foil layer printed with faint repeating SCRATCH lettering; it scratches itself off (or by finger) to reveal IT'S YOURS in lime or NOT THIS TIME in lilac. A hit pops the number and fires confetti in the card tones.

### Keypad
3-column grid of 20px-radius plum candy keys, 10px gaps, height `clamp(46px, 6.6dvh, 66px)`, 30px weight-800 squeezed numerals. Press drops 3px and compresses the bevel. Function keys are flat, transparent and 17px normal width.

## Do's and Don'ts

### Do:
- **Do** assign a card tone from the five card-stock colours by ticket number and always pair it with its ink.
- **Do** use the holographic foil (gradient plus sparkle grain) for anything not yet revealed, and scratch it off to show called or won.
- **Do** set every number in Bricolage Grotesque weight 800 at 75-85% width with tabular figures.
- **Do** give pressable chunky elements a bottom bevel that compresses on press.
- **Do** use the spring easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`) for small press and pop interactions: buttons, chips, keys, the Add button, switch thumbs, card hover, the match pop and toasts.
- **Do** keep touch targets at 44px minimum, and 50px+ for primary actions.
- **Do** honour reduced motion: animations and transitions collapse to near zero.

### Don't:
- **Don't** render tickets as grey list rows or in a premium-wallet register.
- **Don't** put saturated card tones on chrome (top bar, sheet backgrounds, keypad).
- **Don't** use lime and mint interchangeably; lime is yours / won, mint is called.
- **Don't** use the spring overshoot on large moves or anything the owner is waiting to read.
- **Don't** set UI copy in uppercase; uppercase belongs on strips and the reveal panel.
