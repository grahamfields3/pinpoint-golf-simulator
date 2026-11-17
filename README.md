# PINPOINT Golf Lab — Interactive Golf Shot Simulator

An interactive, browser-based golf simulator made for a Digital Marketing take-home exam. Play a 178-yard par 3, pick a club, change swing power and aim, read the wind, and watch an animated golf shot. Track the best shot and your recent attempts.

## Play locally

Open `index.html` in any modern browser. No installation, login, build step, or API key is required. An internet connection is optional; the layout uses a fallback font if Google Fonts is unavailable.

## What can visitors do?

- Select from seven clubs (driver, 3-wood, 5/7/9-iron, pitching wedge, sand wedge).
- Change swing power from 40% to 110%.
- Set shot direction left or right, or click/tap the course to aim.
- Change wind speed and the direction in which the wind blows, or randomize the conditions.
- View a live projected endpoint and predicted distance to the flag.
- Watch an animated ball flight, bounce and roll with approximate wind effects.
- See whether the ball finished on the green, in the fairway, rough, bunker, or water.
- Compare shots with the scorecard, best distance to pin, green hits, and shot history.
- Reset the round and keep experimenting. Spacebar is a shortcut to swing.

**Note:** The course and physics are an illustrative browser game, not a real golf course, GPS measurement, or launch-monitor simulation.

## Publish on GitHub Pages

1. Sign in to [GitHub](https://github.com/) and create a **Public** repository called `pinpoint-golf-simulator` (or another name).
2. Upload `index.html`, `styles.css`, `app.js`, and `README.md` to the **root** of that repository. Commit the files.
3. Go to **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, and save.
4. Wait for GitHub Pages to publish. Under **Settings → Pages**, open the live website URL and test the club buttons, sliders, wind buttons, shot animation, and scoreboard.
5. Submit both your repository URL and your published website URL to the **SECOND TAB** of your class spreadsheet by **Friday, November 20, 2026 at 11:59 PM**.

The project is entirely static, so GitHub Pages can host it without build tools or servers. Usually, the published link has this shape:
`https://YOUR-USERNAME.github.io/pinpoint-golf-simulator/`

The URL above is **only an example**, not your actual published link.

## Project files

- `index.html` — website structure, buttons, labels, accessible controls.
- `styles.css` — dark golf-themed responsive design.
- `app.js` — interactive physics, procedural canvas course, animation, and scoring.

## Ideas to customize

Change the hole distance in `app.js` (the `PIN` constant), edit the club carry distances in `CLUBS`, or edit the headline and colors in `index.html` / `styles.css`.
