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

- Approve: the `approve` button in the Report column of a test run copies the screenshots of that run's failed and SHIFT scenarios into the references. It is shown only for the latest test run of an environment and viewport with status `FAILED` or `SHIFT`, with screenshots still on disk, and only while none of those references changed after the run.
- Screenshot retention: "Keep images of last N runs" in the Test runs header (3 / 5 / 10 / 20 / 50 / all, default 10, stored in `reports\settings.json`). After every test run, older runs of the same environment and viewport lose their `.png` files and `html_report`; `report.json`, `shift.json`, `txt`, `md` and `log` are kept, and their `html` link is greyed out. The latest run is always kept.
- Test is disabled while any selected scenario has no reference for a selected viewport (`npm run test` exits with code 2 in the same case).
- The runs table lists every Reference / Test / Approve launch (from `reports\history.jsonl`, written by the UI and by `npm run …`) plus older test runs, newest first, paginated (10 / 20 / 50 / 100 rows per page): Run, Viewport (command and viewports), Result, Status (`Success` / `SHIFT` / `FAILED` / `STOPPED`) and Report (`html`, `txt`, `md` for test runs, `log` for every launch: `reports\<env>\<type>\<WxH>\<env>_<run>.log` for tests, `<env>_<command>_<YYYYMMDD-HHMMSS>.log` otherwise). The `html` link opens a BackstopJS report for that specific run, stored in `backstop_data\bitmaps_test\<env>\<type>\<WxH>\<run>\html_report\`.

## Commands

Format: `npm run <command> <prep|prod> [viewport] [filter]`

Viewport: `desktop` (1920x1080, default), `mobile` (414x896), or custom `desktop:WxH` / `mobile:WxH`

| Command | Description |
|---|---|
| `npm run reference prod` | Capture reference screenshots |
| `npm run test prod` | Compare against references |
| `npm run approve prod` | Copy screenshots of failed scenarios from the latest test run to references (`APPROVE_RUN=<run>` selects another run) |
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
