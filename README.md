# ATC Strips — VATSIM (Static Web App)

This is a build-free, **static** web app that displays **draggable ATC strips** for a **selected airport** using **live VATSIM data**.

## Features
- Connects to VATSIM `v3/vatsim-data.json` feed.
- Filters pilots by the selected ICAO (either **departure** or **arrival**).
- Renders **ATC strips** styled similar to the reference screenshot.
- **Drag & drop** strips between panels (lanes). Positions persist locally.
- No build step required — works as simple static files.

## How to run
1. Unzip the package.
2. Open `index.html` in a modern browser (Chrome/Edge/Firefox).
3. Enter an airport ICAO (e.g., `EGLL`, `KJFK`, `VIDP`) and click **Load**.
4. Drag strips between lanes as needed.

> Note: Data depends on who is connected to VATSIM at the moment. If you see few/no strips, try a busier airport or use **Refresh** a minute later.

## Customize
- Edit `styles.css` to tweak strip appearance and colors.
- Add or rename lanes by editing `index.html` and updating the `COLS` list in `app.js`.

## Security/CORS
This app fetches directly from `https://data.vatsim.net/v3/vatsim-data.json`. VATSIM currently serves CORS headers that allow browser access. If that changes, you may need to proxy the request from your own server.
