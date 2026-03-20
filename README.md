# ECGithub

Transform your GitHub contribution graph into an ECG heartbeat visualization.

![ECGithub Preview](https://raw.githubusercontent.com/theorakim/ecgithub/main/store/screenshot-01.png)

## Features

- **ECG Waveform** — Contribution data rendered as QRS+T heartbeat peaks. More contributions = taller peaks
- **Adaptive Scaling** — Peaks automatically scale to fit without overlapping, whether you have 10 or 52 weeks of activity
- **Stats Panel** — Total contributions, best day, daily average, longest streak, current streak
- **Color Themes** — GitHub Green, Blue, Purple, Sunset, Halloween + custom color picker
- **View Modes** — Normal / ECG / Both — toggle between original graph and ECG
- **Year Switching** — Seamlessly updates when you browse different years
- **PNG Export** — Save your ECG visualization as an image
- **Light & Dark Mode** — Follows GitHub's theme automatically

## Install

### Chrome Web Store
Coming soon.

### Manual Install
1. Download or clone this repo
2. Open `chrome://extensions`
3. Enable **Developer mode** (top right)
4. Click **Load unpacked** → select the `ecgithub` folder
5. Visit any GitHub profile page

## How It Works

The extension reads GitHub's contribution graph data (level 0–4 per day/week) and converts it into SVG paths using a QRS+T waveform algorithm inspired by real ECG signals. The engine was originally built for [byminseok.com](https://byminseok.com/en/2026-02-22/building-a-heartbeat-timeline-for-the-blog-home/).

## Tech Stack

- Vanilla JavaScript (no frameworks, no bundler)
- Chrome Extension Manifest V3
- SVG path generation with cubic Bezier curves
- `chrome.storage.sync` for settings

## Permissions

- **storage** — Save your theme and display preferences
- **Host** — `github.com` only (reads contribution graph data)

## License

MIT

## Author

[byminseok.com](https://byminseok.com)
