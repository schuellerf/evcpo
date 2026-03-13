# HACS Integration Guide

This document describes how to use the EV Charge Price Optimizer as a HACS plugin in Home Assistant. The current standalone web app will need adaptation to run as a Lovelace card.

## Prerequisites

- Home Assistant with HACS installed
- Local or test instance

## Build for HACS

1. Build the app:

   ```bash
   npm run build
   ```

2. Output is in `dist/`. The main bundle is `dist/assets/*.js` (Vite produces hashed filenames). For HACS, you typically need a single `.js` file.

3. HACS plugin layout requirements:
   - `.js` files in `dist/` or repository root
   - At least one `.js` file matching the repo name (or `lovelace-<name>.js` if repo starts with `lovelace-`)
   - Optional: `manifest.json` with metadata

## Vite Configuration for HACS

To produce a single `evcpo.js` (or `lovelace-evcpo.js`) in `dist/`, adjust `vite.config.ts`:

```ts
// vite.config.ts – add build.rollupOptions for single-file output
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'evcpo.js',
        chunkFileNames: 'evcpo.js',
        assetFileNames: 'evcpo.[ext]',
      },
    },
  },
  // ... server proxy
});
```

## Lovelace Configuration

Add a custom card in your dashboard:

```yaml
type: module
url: /local/evcpo.js
# or, when installed via HACS:
# url: /hacsfiles/evcpo/evcpo.js
```

## Future Work (Lovelace Card)

The current app is a standalone SPA. To integrate as a proper Lovelace card:

1. Wrap the UI in a Lit custom element (`<evcpo-card>`) that implements the Lovelace card interface
2. Define a config schema (optional config for defaults like charge speed)
3. Fetch price data via HA’s `hass.fetch` or a dedicated integration
4. Bundle with the same build output for HACS

## Repository Layout (HACS Plugin)

```
evcpo/
├── dist/
│   └── evcpo.js
├── hacs.json          # optional, HACS metadata
├── manifest.json      # version, name, etc.
└── README.md
```

Example `manifest.json`:

```json
{
  "version": "0.1.0",
  "name": "EV Charge Price Optimizer"
}
```
