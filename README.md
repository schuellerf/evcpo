# EV Charge Price Optimizer

A web app that optimizes EV charging based on electricity prices from [awattar.at](https://www.awattar.at). Currently supports Austria (AT) only. The resulting price limit can be used with chargers like go-e.

## Standalone Web App

### Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. The app uses a proxy to fetch prices from awattar.at (avoids CORS when running locally).

### Build for production

```bash
npm run build
npm run preview
```

Preview serves the built app (default port 4173). Use the proxy by running on localhost.

### Static deployment

The app is client-side only. `npm run build` outputs a static bundle to `dist/`. Deploy the entire `dist/` folder to any static host (nginx, Apache, Netlify, GitHub Pages, S3, etc.). No server-side setup required.

### Inputs

- **Current SOC (%)** – Current state of charge of the battery
- **Target SOC (%)** – Desired state of charge when charging finishes
- **Target time** – When charging must be complete (e.g. tomorrow 10:00)
- **Charge speed (%/hour)** – Charging rate in percent per hour

### Output

- **Result**: "Charge for X hours. Average price: Y ct/kWh" – Uses the N cheapest hours before target time, where N = hours needed
- **3D chart**: Average price (ct/kWh) by target hour (X) and target SOC (Y). Hover over the surface to see exact values. Prices from awattar.at (EPEX Spot).

## HACS Integration

See [HACS.md](HACS.md) for step-by-step instructions on importing this app as a HACS plugin into a local Home Assistant test instance.
