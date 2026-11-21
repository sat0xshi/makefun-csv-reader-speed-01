# makefun-csv-reader-speed-01

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/sat0xshi/makefun-csv-reader-speed-01/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/sat0xshi/makefun-csv-reader-speed-01/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A fast drop-in for make.fun's csv-reader 1.0.0. `solve.js` reads a CSV text exactly as csv-reader does — every broken row, stray CR, quote junk and unterminated quote included — and answers `{columns, rows, errors}`, but where the reference walks one character at a time and grows each field a character at a time, this reader scans with `charCodeAt` and builds each field from whole slices of the text between special characters, so it runs about twice as fast. `main.ts` is the harness driver: it reads `/input/cases.json`, answers each case alone with `run()`, and writes `/output/answers.json`.

## Run it

```sh
MAKEFUN_INPUT_DIR=/input MAKEFUN_OUTPUT_DIR=/output node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=6sph882q&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
