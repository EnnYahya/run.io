# TerriRun

Run a loop in real life, come back to your start point, and **claim the area inside it on a shared map** — like paper.io 2, but on the real world. Later claims take over earlier ones.

This is a static website (no server to run). It uses:

- **Leaflet + OpenStreetMap** for the map (free, no credit card; satellite view from Esri is included too)
- **Turf.js** for the geometry (closing the loop, cutting overlaps, computing the area)
- **Firebase** (Authentication + Firestore) to save players and territories live
- **GitHub Pages** to host it for free (HTTPS, required for GPS)

## Files

| File | What it does |
|---|---|
| `index.html` | The page |
| `style.css` | The look |
| `app.js` | All the game logic |
| `config.js` | **Your Firebase settings** + the game rules you can tweak |
| `firestore.rules` | Security rules to paste into Firebase |

## Setup (about 15 minutes)

### 1. Create the Firebase project
1. Go to <https://console.firebase.google.com> and click **Add project** (you can turn Google Analytics off).
2. On the project home page, click the **web icon `</>`** to add a web app. Give it any name. Skip "Firebase Hosting".
3. Firebase shows a block of code with `firebaseConfig = { apiKey: ..., ... }`. **Copy those values into `config.js`** (replace the `PASTE_...` / `YOUR_...` text).

> The API key in this file is meant to be public. What protects your data are the rules in step 3.

### 2. Turn on anonymous sign-in
**Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save.**
Players get an invisible account automatically, then pick a name and color.

### 3. Create the database and add the rules
1. **Build → Firestore Database → Create database.** Choose a European location (for example `eur3`) and **Production mode**.
2. Open the **Rules** tab, delete everything, paste the content of `firestore.rules`, and click **Publish**.

### 4. Put it on GitHub
1. Create a new repository on GitHub (public is fine).
2. **Add file → Upload files**, drag in **all the files from this folder** (`index.html`, `style.css`, `app.js`, `config.js`, `firestore.rules`, `README.md`), and commit.
3. **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `(root)` → Save.**
4. After a minute your site is live at `https://YOUR-NAME.github.io/YOUR-REPO/`.

### 5. Allow your site in Firebase
**Authentication → Settings → Authorized domains → Add domain** → `YOUR-NAME.github.io`.

### 6. Test it
1. Open your site on your phone and **allow location** when asked.
2. Pick a name and color.
3. At your desk, tick **Simulation** and press Start: a fake runner does a 250 m square around the center of the map and claims it.
4. Outside: press Start, run a loop, and come back within 30 m of where you started. The area is claimed automatically.

## How it works
- The phone's GPS position is recorded while you run (points less accurate than 35 m or closer than 5 m to the last one are ignored).
- When you are back within **30 m of your start** after at least **200 m**, the loop closes and becomes a polygon.
- Your new area is saved in Firestore. **Any older territory it overlaps (yours or other players') is cut** so the newest claim wins.
- The leaderboard adds up each player's area. Tap a zone on the map to see its owner.

## Game rules you can change (`config.js`)
`closeDistanceM`, `minLoopLengthM`, `minAreaM2`, `maxAreaM2`, `maxSpeedKmh`, `maxAccuracyM`, `minStepM`.
Runs faster than `maxSpeedKmh` (default 25 km/h) are cancelled, so bikes and cars don't count.

## Before opening it to the public
- Set `allowSimulation: false` in `config.js` (otherwise anyone can fake a claim anywhere).
- This first version trusts the player's phone, so a determined person could still cheat with browser tools. A stricter version would check runs on a server (Firebase Cloud Functions).
- **Privacy:** the map shows claimed areas, which reveal where people run, and loops starting at home show where they live. Add a notice and consider a rule such as "the first 100 m of a run is trimmed" before a public launch (GDPR applies).
- Firestore's free plan allows about 50,000 reads per day. Each visitor loads all territories once, which is fine for a club-sized game.

## Known limits of this version
- **The screen must stay on.** Browsers pause GPS when the phone locks. The app asks the phone to keep the screen awake while running, which works on most recent phones. A real mobile app would fix this fully.
- A run in progress is lost if the page is closed or reloaded.
- If two people claim the same spot at the exact same moment, the result may be slightly off.

## About Google Maps
You asked for a Google Maps map. Google Maps needs an API key with a billing card attached and has rules against reusing its tiles outside its own library. OpenStreetMap does the same job for free, so I used that. If you really want Google Maps later, only the map part of `app.js` needs to change.
