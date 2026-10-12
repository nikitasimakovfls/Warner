# Warner visual regression tests

Environments: `prep` — https://prep.warnerleisurehotels.co.uk, `prod` — https://www.warnerhotels.co.uk

## Setup

```
npm install
```

## Commands

Format: `npm run <command> <prep|prod> [filter]`

| Command | Description |
|---|---|
| `npm run reference prod` | Capture reference screenshots |
| `npm run test prod` | Compare against references |
| `npm run approve prod` | Promote the latest test screenshots to references |
| `npm run report prod` | Open the HTML report |
| `npm run summary prod` | Rebuild the text report for the latest test run |

Filter is a regular expression matched against the scenario label (`label` in `backstop.config.js`):

```
npm run reference prod Alvaston
npm run test prod "Festive|Alvaston"
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

## Output

| Item | Path |
|---|---|
| References | `backstop_data\bitmaps_reference\<env>\` |
| Test screenshots | `backstop_data\bitmaps_test\<env>\<timestamp>\` |
| HTML report | `backstop_data\html_report\<env>\index.html` |
| Jira report (`.txt`, `.md`) | `reports\<env>\` |

## Configuration

| Item | Location |
|---|---|
| Page list | `backstop.config.js` → `pages` |
| Environment URLs | `environments.js` |
| Viewports | `.env` → `VIEWPORTS=Desktop,Tablet,Mobile` |
