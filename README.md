# Miniwall Spec

The shared standard behind the Miniwall SDKs: the screen format (`PaywallData`), the rules for laying it out, and the test data every SDK is checked against. The Web, iOS, Android, React Native and Flutter SDKs all pass the same data, so a screen looks and behaves the same everywhere.

This repository is data and documentation. There is no runtime code to install.

| Path | What |
|---|---|
| `schema/paywall.schema.json` | JSON Schema (draft-07) for a screen (`PaywallData`). Structural: it checks types, allowed values and shapes, but only requires the frame of a screen (the renderer fills in defaults), and unknown extra properties are allowed, so an SDK can read a screen written by a newer editor. |
| `docs/01-layout.md` | How stacks are sized and placed, written so a native renderer can reproduce it frame for frame. |
| `fixtures/layout`, `fixtures/components` | Small screens, one rule each (`{ description, paywall }`). |
| `fixtures/icons` | The icon set the fixtures use, as SVG. |
| `golden/layout`, `golden/components`, `golden/icons` | The expected frames (`id -> { x, y, w, h }`, in CSS px = pt = dp) for each fixture at two viewports (375x812 and 768x1024). |
| `vectors/*.json` | Logic cases for the parts every SDK must agree on: `{ input, expected }` for variables, markdown, conditions, targeting, A/B buckets, URLs, countdowns, product variables, flows. |
| `mock-api/` | A tiny stand-in for the delivery API (`/v1/sdk/...`) with test screens, for SDK tests. No dependencies. |

## Run the checks

```bash
npm ci
npm test
```

The suite checks that every fixture has a complete golden, that every vector is well formed, that every fixture and every mock-API screen validates against the schema, that the mock API behaves as documented, and that nothing that should not be public slipped in.

## Using it from an SDK

Pin a release (`spec-vX.Y.Z` tag) in your CI, download or check it out, and read the files by path. A change to the standard is made here first (fixture + vector + description); each SDK then upgrades its pinned version and fixes what turns red.

The golden frames come from the reference renderer in Chromium and are published as data. They are updated by the maintainers; a pull request that edits a golden by hand will not be merged, so open an issue describing the difference you see.

## License

MIT (see `LICENSE`). Icon artwork is from Lucide (ISC), see `THIRD_PARTY_NOTICES.md`. The name and logo are covered by `TRADEMARK.md`.
