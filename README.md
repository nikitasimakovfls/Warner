# Warner visual regression tests

Environments: `prep` — https://prep.warnerleisurehotels.co.uk, `prod` — https://www.warnerhotels.co.uk

## Setup

```
npm install
```

## Web UI

```
npm run ui
```

Opens http://127.0.0.1:3210 (local only). Pick the environment, one or more viewports (presets or custom) and scenarios, then run Reference / Test; selected viewports run one after another. The log streams live. Port: `UI_PORT` env variable.

- Approve: the `approve` button in the Report column of a test run opens a dialog with that run's failed and SHIFT scenarios as checkboxes (all checked by default, All / None); only the checked scenarios are copied into the references. It is shown only for the latest test run of an environment and viewport with status `FAILED` or `SHIFT`, with screenshots still on disk, and only while none of those references changed after the run.
- References: a viewport row is green when every scenario has a reference and yellow otherwise; BackstopJS error placeholders (written when a capture fails) count as missing. "Clear refs" under the viewport list deletes all reference screenshots of the selected viewports.
- Custom viewports: name, width and height in the Viewport card, then Add. The type follows the width (`< 768` mobile, `768-1023` tablet, `>= 1024` desktop). The list is stored in `reports\viewports.json` and shared by all browsers; Remove only drops it from the list, references stay on disk.
- Settings: gear button in the top right corner, stored in `reports\settings.json`, read-only while a run is in progress.
- Mismatch threshold (Settings): `misMatchThreshold` in percent of differing pixels for every scenario (0 to 100, two decimals, default 0.01). It is printed in the `settings:` line of every run log.
- Capture threads: `asyncCaptureLimit` per viewport (1 / 2 / 3 / 4 / 6 / 8 / 10 / 12, default 4). Also applies to `npm run reference|test` from the command line.
- Parallel viewports: number of selected viewports run at the same time from the UI (1 / 2 / 3 / 4, default 1). Live log lines are prefixed with `[type/WxH]`; per-viewport logs are written separately. Total Chromium instances = capture threads x parallel viewports.
- Page load: `page.goto` `waitUntil` for all scenarios (`load` / `domcontentloaded`, default `load`). A scenario's own `engineOptions.gotoParameters` (Heythrop_Park_Golf_Club) takes precedence. The value is printed in the `settings:` line of every run log and in `npm run timing`.
- Screenshot retention: "Keep images of last N runs" in Settings (3 / 5 / 10 / 20 / 50 / all, default 10). After every test run, older runs of the same environment and viewport lose their `.png` files and `html_report`; `report.json`, `shift.json`, `txt`, `md` and `log` are kept, and their `html` link is greyed out. The latest run is always kept.
- Test is disabled while any selected scenario has no reference for a selected viewport (`npm run test` exits with code 2 in the same case).
- The runs table lists every Reference / Test / Approve launch (from `reports\history.jsonl`, written by the UI and by `npm run …`) plus older test runs, newest first, paginated (10 / 20 / 50 / 100 rows per page): Run, Viewport (command and viewports), Result, Status (`Success` / `SHIFT` / `FAILED` / `STOPPED`) and Report (`html`, `txt`, `md` for test runs, `log` for every launch: `reports\<env>\<type>\<WxH>\<env>_<run>.log` for tests, `<env>_<command>_<YYYYMMDD-HHMMSS>.log` otherwise). The `html` link opens a BackstopJS report for that specific run, stored in `backstop_data\bitmaps_test\<env>\<type>\<WxH>\<run>\html_report\`.

## Commands

Format: `npm run <command> <prep|prod> [viewport] [filter]`

Viewport: `desktop` (1920x1080, default), `tablet` (768x1024), `mobile` (414x896), or custom `desktop:WxH` / `tablet:WxH` / `mobile:WxH`. Tablet and mobile use touch emulation and a tablet / phone user agent (Android).

| Command | Description |
|---|---|
| `npm run reference prod` | Capture reference screenshots |
| `npm run test prod` | Compare against references |
| `npm run approve prod` | Copy screenshots of failed scenarios from the latest test run to references (`APPROVE_RUN=<run>` selects another run; `npm run approve prod desktop "^Deals$"` limits it to matching scenarios) |
| `npm run report prod` | Open the HTML report |
| `npm run summary prod` | Rebuild the text report for the latest test run |

Filter is a regular expression matched against the scenario label (`label` in `backstop.config.js`):

```
npm run reference prod Alvaston
npm run test prod "Festive|Alvaston"
npm run reference prod mobile
npm run test prod mobile Homepage
npm run test prod desktop:1366x768
```

## Release regression

```
npm run reference prod
npm run test prod
npm run approve prod
```

1. `reference` — before the release
2. `test` — after the release
3. `approve` — if the changes are expected

## Shift detection

After every `test` run, each failed scenario is re-checked row by row (`shift.js`). Pixel rows of the reference and test screenshots are aligned with a diff algorithm, so a block that only moved up or down no longer marks everything below it as changed.

| Status | Meaning |
|---|---|
| `PASS` | BackstopJS passed |
| `SHIFT` | Content is identical but moved: rows of blank spacing added or removed (margin, padding, border), or blocks moved horizontally by up to 40px (`moved: dx=-24@y=2032..2045`) |
| `FAIL` | Content changed; the `Changes` column lists the changed ranges (`y` in test screenshot pixels) |

`Changes` example: `changed: y=1336..1377 | shifts: -8px@y=1434, +10px@y=2196 | net +2px`. Full data per run: `backstop_data\bitmaps_test\<env>\<type>\<WxH>\<run>\shift.json`. BackstopJS's own HTML report still shows `SHIFT` scenarios as failed.

## Output

| Item | Path |
|---|---|
| References | `backstop_data\bitmaps_reference\<env>\<type>\<WxH>\` |
| Test screenshots | `backstop_data\bitmaps_test\<env>\<type>\<WxH>\<timestamp>\` |
| HTML report | `backstop_data\html_report\<env>\<type>\<WxH>\index.html` |
| Jira report (`.txt`, `.md`) | `reports\<env>\<type>\<WxH>\` |

## Configuration

| Item | Location |
|---|---|
| Shared components (promo banner, header per theme, footer) | `backstop.config.js` → `components` |
| Page list (promo banner, header and footer hidden) | `backstop.config.js` → `pages` |
| Environment URLs | `environments.js` |
| Viewport presets | `viewports.js` |
| Custom viewports | `reports\viewports.json` (managed from the UI) |

## Timing

- Capture mode (Settings): `stitched` (default) assembles the full-page screenshot from viewport-height screenshots, each taken inside the viewport after scrolling and two animation frames + 50 ms, so every part is fully rendered; `fullpage` uses Chrome's single full-page capture, where parts beyond the viewport can come out low-res or blank. Position:fixed elements are captured in the first slice only (as in a fullpage capture). Stitched falls back to fullpage when the page is zoomed (no meta viewport), contains visible position:sticky elements, or its layout changes while scrolling (60 anchor elements and the page height are checked at every slice). The run log prints `stitch | slices=N | WxH | fixed=N` or `stitch | fallback fullpage | <reason>` per scenario.
- Paint pass before capture (`paint` phase, both modes): the page is scrolled through one viewport height at a time, two animation frames + 60 ms per step, then back to the top, so every region is rasterized inside the viewport with all images decoded before the full-page screenshot.
- Lazy images that are visible (non-zero size, inside the viewport horizontally) are switched to `loading=eager` before waiting, so partially visible slider items load instead of timing out.
- Every scenario writes a `<label> | timing | ...` line to the run log: `goto` (onBefore + page load), `prep`, `scroll`, `images`, `idle` (waitForNetworkIdle), `pause`, `sliders`, `settle`, `total` (ms), plus `height`, `pendingImages` (waited for), `skippedImages` (lazy images hidden or outside the viewport horizontally, not waited for), `idleTimeout`, `final` (last pass before the screenshot: visible images not yet loaded are switched to eager and awaited up to 5 s, then every visible image is decoded via `img.decode()` up to 3 s), `lateImages` / `stillLateImages` (visible images incomplete at the start / end of that pass), `lowresImages` (visible images with naturalWidth < 90% of rendered width; listed in a separate `<label> | lowres | ...` line). Images still incomplete after the 10 s wait are listed in a `<label> | stuckImages | ...` line.
- `npm run timing` prints avg / p50 / p90 / max / share per phase for the latest log with timing data; `npm run timing -- <log> [<log> ...]` for specific logs.
- Every scenario writes the state of its visible images (file, requested width, naturalWidth, rendered width, position, sizes) to `reports\imgstate\<host>\<Type>_<WxH>\<run start>\<label>.json`; the timing line carries `imgSig`, a hash of that state.
- `npm run imgstate -- <label> [<Type>_<WxH>]` lists the images whose state differs between runs of that scenario.
