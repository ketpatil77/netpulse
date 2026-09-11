# NetPulse

A lightweight React + TypeScript network reachability dashboard. Add HTTP/HTTPS targets, periodically probe them from the browser, track latency, view recent health signals, and export collected results as CSV.

## What it does

- Add and remove HTTP/HTTPS monitoring targets
- Automatically probe active targets every 10 seconds
- Track response latency and reachability failures
- Show healthy, degraded, and down summaries
- Persist targets and the latest 1,000 results in browser `localStorage`
- Export monitoring history as CSV
- Visualize recent latency history with Recharts

> **Important:** browser-based probes use `no-cors`, so the app measures network reachability rather than inspecting HTTP status codes from cross-origin targets. A successful opaque response means the request completed from the browser's perspective; it does not prove the server returned HTTP 2xx.

## Stack

- React 19
- TypeScript
- Vite
- Recharts
- Lucide React
- Tailwind CSS 4
- Oxlint

## Local development

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

## Quality checks

```bash
npm run build
npm run lint
```

## Data and privacy

Monitoring targets and collected results are stored locally in the browser. The application does not provide a backend database or central monitoring service.

## Limitations

- Monitoring stops when the page is closed or suspended by the browser.
- Cross-origin browser security prevents reliable inspection of remote HTTP status codes without a server-side probe.
- Browser scheduling is best-effort, so the 10-second interval is not a hard real-time guarantee.
