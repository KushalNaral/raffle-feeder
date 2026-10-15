# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite (user's choice), static build deployed to GitHub Pages via GitHub Actions.

## Users

One person (the owner), on their own phone, holding a stack of paper raffle tickets from an event (e.g. a company Tihar/Dashain celebration). They photograph tickets, then stand in a crowded hall listening for numbers being called and need to know instantly whether a called number is theirs.

## Product Purpose

Turn a pile of paper raffle tickets into a searchable personal list. Capture ticket photos (camera, gallery, or many at once), read the handwritten ticket number on-device and let the owner confirm it, then list the tickets and let the owner mark which ones were called / won. Success: during the draw, a called number can be checked in under two seconds, and nothing is lost.

## Positioning

A private, offline, single-purpose companion for the physical ritual of a paper raffle draw — not a raffle-hosting or ticket-selling tool.

## Operating Context

- Tickets are printed paper stubs with a hand-written number (e.g. "चिट्ठा नम्बर: 361"), often in Nepali/English mix, photographed in mixed indoor light, sometimes rotated or stapled in a booklet.
- Use is bursty: one capture session before the event, then a high-pressure few minutes during the draw, often one-handed in a noisy room.

## Capabilities and Constraints

- Inputs: camera capture, gallery pick, bulk multi-select.
- On-device OCR suggests the number; owner always confirms or corrects (handwriting OCR is imperfect).
- Data (photos + numbers + called state) stored only in this browser (IndexedDB). No accounts, no server. Export/import backup for moving devices.
- Works offline once loaded; installable to home screen is desirable.
- Must be fully usable at phone width.

## Evidence on Hand

- One sample ticket photo provided by the user (Yenya Soft "बडा दशैं कहाँ छ" style event ticket, number 361, Oct 16, Sanepa, Lalitpur). No other real data; any demo content must be labeled as sample.
- A second photo from the same event (ticket 362, on dark fabric) is kept as a test fixture (`src/test/photos/ticket-362.jpg`) for the automatic number finder.

## Product Principles

1. The draw moment rules: checking a called number beats every other feature in priority and speed.
2. Never lose a ticket: storage is local but durable, with an export path.
3. Machine guesses, human confirms: OCR is an assist, never silent truth.
4. Private by default: photos never leave the device.

## Accessibility & Inclusion

Large touch targets for one-handed use in a crowd; numbers readable at arm's length; Devanagari text supported in the UI where tickets use it.
