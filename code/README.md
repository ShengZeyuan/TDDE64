# xG project — code

Minimum-viable Expected Goals pipeline for the TDDE64 project.

## Layout

```
code/
├── requirements.txt        # Python dependencies
├── utils.py                # geometry + evaluation helpers
├── download_data.py        # Wyscout open data from Figshare
├── prepare_data.py         # JSON → tidy shots.csv with features
├── train_eval.py           # LR + XGBoost × 3 imbalance strategies
├── make_plots.py           # ROC curves, feature importance, EDA
└── results/                # populated by train_eval.py
```

## Setup (Windows PowerShell)

```powershell
# from the repository root
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r code\requirements.txt
```

## Run

```powershell
cd code

# Step 1 — download ~250 MB of Wyscout JSONs (skips files already present)
python download_data.py

# Step 2 — extract shots and engineer features
python prepare_data.py

# Step 3 — train all six configurations and dump metrics
python train_eval.py

# Step 4 — produce figures used by the LaTeX report
python make_plots.py
```

After Step 3 you will find:

- `code/results/metrics.csv` — one row per (model, imbalance) configuration.
- `code/results/predictions.csv` — test-set probabilities, used by `make_plots.py`.
- `code/results/results_table.tex` — booktabs body to `\input` into the report.
- `code/results/feature_importance.csv` — XGBoost gain importances.

After Step 4:

- `figures/roc_curves.pdf`
- `figures/feature_importance.pdf`
- `figures/eda_distance_angle.pdf`

## What each script does

### `download_data.py`

Queries the Figshare API for the four articles in Pappalardo et al. (2019)
and downloads `events*.zip`, `matches*.zip`, `players.json`, `teams.json`
into `../data/`. Existing files are skipped.

### `prepare_data.py`

Streams every `events_*.json`, walks each match in temporal order, and
extracts shot events. For each shot it records:

- raw `(x, y)` Wyscout coordinates and the engineered `distance` (m)
  and `angle` (rad) of the visible goal-mouth (Caley 2013 formula)
- one-hot `body_foot` / `body_head`
- `is_free_kick` (excluding penalties, which are removed entirely)
- `score_diff` at the time of the shot (your team minus opponent)
- `period` and `minute` of the match
- `is_goal` label (Wyscout tag id 101)

The final `shots.csv` is the only artefact downstream scripts need.

### `train_eval.py`

- Match-level grouped split: 70 % train / 15 % val / 15 % test, so that
  shots from the same match never appear in two folds.
- Six configurations: {Logistic Regression, XGBoost} × {none,
  class-weight, SMOTE}.
- Logistic Regression: `StandardScaler` on numeric features,
  `class_weight="balanced"` for the class-weight strategy.
- XGBoost: histogram tree method, `scale_pos_weight = N_neg / N_pos`
  for the class-weight strategy.
- SMOTE is fit only on the training fold.
- Metrics: AUC-ROC, AUC-PR, F1, sensitivity, specificity, log-loss.

### `make_plots.py`

Produces three PDFs:

1. **ROC curves** — all six configurations on the same axes.
2. **Feature importance** — XGBoost gain importances, top-15 horizontal
   bar chart.
3. **EDA** — empirical goal rate as a function of distance and angle,
   useful for the *Background* section of the report.

## Reproducibility

Every script seeds NumPy, scikit-learn and XGBoost with `RANDOM_STATE=42`.
SMOTE is also seeded. Re-running the pipeline from scratch produces
bit-identical metrics on the same hardware.

## Limitations (carry into Future Work)

- No probability calibration analysis (Brier score, reliability diagrams)
  — drop-in extension; reuse `predictions.csv`.
- No hyper-parameter tuning loop; defaults were picked from
  literature-typical values. Add an Optuna study on `train_df` with the
  validation fold as objective.
- No Understat benchmark — would require scraping and shot matching.
- No StatsBomb 360 freeze-frame features (defender pressure, GK
  position) — Wyscout doesn't expose them.
