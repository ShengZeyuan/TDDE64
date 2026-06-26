r"""Train Logistic Regression and XGBoost on the Wyscout shot data and evaluate.

在 Wyscout 射门数据上训练 Logistic Regression 和 XGBoost,并评估结果。

Pipeline
--------
1. Load ``../data/shots.csv``.
2. Match-level stratified split: 70% train, 15% val, 15% test
   (so that no shots from the same match leak across folds).
3. For every (model, imbalance-strategy) pair, train on the train fold
   with fixed hyperparameters and evaluate on the held-out test fold.
   The validation fold is saved for future hyperparameter tuning.
4. Save:
   - ``results/metrics.csv``       (one row per configuration)
   - ``results/predictions.csv``   (test-set probabilities for plotting)
   - ``results/results_table.tex`` (booktabs body, ready to \input)

Run after ``prepare_data.py`` has produced ``shots.csv``.
需要先运行 ``prepare_data.py`` 生成 ``shots.csv`` 后再执行本脚本。
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier

from utils import (
    DATA_DIR,
    RESULTS_DIR,
    EvalRow,
    evaluate_predictions,
    latex_results_table,
    metrics_dataframe,
)

# Numeric features are standardised for Logistic Regression.
# 数值特征会在 Logistic Regression 中做标准化。
NUMERIC_FEATURES = ["distance", "angle", "x", "y", "minute", "score_diff"]

# Binary features are already on a 0/1 scale and can pass through unchanged.
# 二值特征已经是 0/1,不需要标准化。
BINARY_FEATURES = ["body_foot", "body_head", "is_free_kick"]
ALL_FEATURES = NUMERIC_FEATURES + BINARY_FEATURES
LABEL = "is_goal"

# One global seed keeps all random operations reproducible.
# 统一随机种子,保证实验结果可复现。
RANDOM_STATE = 42


def load_data(path: Path) -> pd.DataFrame:
    """Load the shot dataframe and verify the required columns are present.

    读取 ``shots.csv`` 并检查训练所需字段是否齐全。
    """
    df = pd.read_csv(path)
    missing = set(ALL_FEATURES + [LABEL, "match_id"]) - set(df.columns)
    if missing:
        raise ValueError(f"shots.csv is missing columns: {missing}")
    return df


def match_level_split(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Split into 70/15/15 train/val/test grouped by match_id (no leakage).

    按 match_id 分组划分训练/验证/测试集,防止同一场比赛的射门同时出现在训练和测试中。
    """
    # First split off a 30% holdout, then split that holdout equally into
    # validation and test. GroupShuffleSplit guarantees match-level separation.
    # 先划出 30% 留出集,再平分成验证集和测试集;GroupShuffleSplit 保证按比赛分组。
    gss1 = GroupShuffleSplit(n_splits=1, test_size=0.30, random_state=RANDOM_STATE)
    train_idx, holdout_idx = next(gss1.split(df, groups=df["match_id"]))
    train_df = df.iloc[train_idx].reset_index(drop=True)
    holdout_df = df.iloc[holdout_idx].reset_index(drop=True)
    gss2 = GroupShuffleSplit(n_splits=1, test_size=0.50, random_state=RANDOM_STATE)
    val_idx, test_idx = next(gss2.split(holdout_df, groups=holdout_df["match_id"]))
    val_df = holdout_df.iloc[val_idx].reset_index(drop=True)
    test_df = holdout_df.iloc[test_idx].reset_index(drop=True)
    return train_df, val_df, test_df


def make_logreg_pipeline(class_weight=None) -> Pipeline:
    """Logistic Regression with standardisation of numeric features.

    构造 Logistic Regression pipeline:数值特征标准化,二值特征直接通过。
    """
    pre = ColumnTransformer(
        transformers=[
            ("num", StandardScaler(), NUMERIC_FEATURES),
            ("bin", "passthrough", BINARY_FEATURES),
        ]
    )
    clf = LogisticRegression(
        solver="lbfgs",
        max_iter=1000,
        C=1.0,
        class_weight=class_weight,
        random_state=RANDOM_STATE,
    )
    return Pipeline([("pre", pre), ("clf", clf)])


def make_xgb(scale_pos_weight: float | None = None) -> XGBClassifier:
    """XGBoost with sensible defaults for tabular shot data.

    构造 XGBoost 分类器;参数选择偏保守,适合中等规模表格数据。
    """
    params = dict(
        n_estimators=400,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=RANDOM_STATE,
        n_jobs=-1,
        tree_method="hist",
    )
    if scale_pos_weight is not None:
        params["scale_pos_weight"] = scale_pos_weight
    return XGBClassifier(**params)


def smote_resample(X: pd.DataFrame, y: pd.Series) -> tuple[pd.DataFrame, pd.Series]:
    """Apply SMOTE to numeric+binary features (binary cols stay numeric).

    仅在训练集上使用 SMOTE 生成少数类样本,避免测试集数据泄漏。
    """
    smote = SMOTE(random_state=RANDOM_STATE, k_neighbors=5)
    X_res, y_res = smote.fit_resample(X.values, y.values)
    return pd.DataFrame(X_res, columns=X.columns), pd.Series(y_res, name=y.name)


def train_one(
    model_name: str,
    imbalance: str,
    train_df: pd.DataFrame,
    test_df: pd.DataFrame,
) -> tuple[EvalRow, np.ndarray]:
    """Fit one (model, imbalance) configuration and return its test metrics.

    训练一个模型配置,返回测试集指标和每个测试样本的进球概率。
    """
    X_train, y_train = train_df[ALL_FEATURES], train_df[LABEL]
    X_test, y_test = test_df[ALL_FEATURES], test_df[LABEL]

    if imbalance == "smote":
        # SMOTE must be fitted after the split and only on the training fold.
        # SMOTE 必须在划分数据之后、且只对训练集执行。
        X_train, y_train = smote_resample(X_train, y_train)

    if model_name == "lr":
        cw = "balanced" if imbalance == "class_weight" else None
        clf = make_logreg_pipeline(class_weight=cw)
        clf.fit(X_train, y_train)
        proba = clf.predict_proba(X_test)[:, 1]
    elif model_name == "xgb":
        if imbalance == "class_weight":
            # For XGBoost, class weighting is controlled by scale_pos_weight.
            # 在 XGBoost 中,类别权重通过负样本/正样本比例设置。
            n_pos = (y_train == 1).sum()
            n_neg = (y_train == 0).sum()
            spw = n_neg / max(n_pos, 1)
        else:
            spw = None
        clf = make_xgb(scale_pos_weight=spw)
        clf.fit(X_train, y_train)
        proba = clf.predict_proba(X_test)[:, 1]
    else:
        raise ValueError(f"unknown model {model_name!r}")

    row = evaluate_predictions(y_test.to_numpy(), proba, model=model_name, imbalance=imbalance)
    return row, proba


def save_xgb_feature_importance(train_df: pd.DataFrame) -> None:
    """Refit a vanilla XGBoost on all training data and dump gain importances.

    在训练集上重新拟合一个普通 XGBoost,并保存 gain 特征重要性。
    """
    X_train, y_train = train_df[ALL_FEATURES], train_df[LABEL]
    clf = make_xgb()
    clf.fit(X_train, y_train)
    booster = clf.get_booster()
    gains = booster.get_score(importance_type="gain")
    rows = []
    for raw_name, value in gains.items():
        # XGBoost may return either raw feature names or f0/f1-style names,
        # depending on the input type/version. Handle both for robustness.
        # 不同 XGBoost 版本可能返回原始列名或 f0/f1,这里两种都兼容。
        if raw_name.startswith("f") and raw_name[1:].isdigit():
            feature = ALL_FEATURES[int(raw_name[1:])]
        else:
            feature = raw_name
        rows.append({"feature": feature, "gain": value})
    fi = pd.DataFrame(rows).sort_values("gain", ascending=False)
    for f in ALL_FEATURES:
        if f not in fi["feature"].values:
            fi = pd.concat(
                [fi, pd.DataFrame([{"feature": f, "gain": 0.0}])], ignore_index=True
            )
    fi.to_csv(RESULTS_DIR / "feature_importance.csv", index=False)
    print("Feature importance:")
    print(fi.to_string(index=False, float_format=lambda v: f"{v:.4f}"))


def main(shots_path: Path) -> None:
    """Run the full training/evaluation pipeline.

    运行完整训练与评估流程,并把指标、预测概率和 split 大小写入 results 文件夹。
    """
    print(f"Loading {shots_path} ...")
    df = load_data(shots_path)
    print(f"  {len(df):,} shots, {df[LABEL].mean()*100:.2f}% goals")

    train_df, val_df, test_df = match_level_split(df)
    print(
        f"  split: train {len(train_df):,} | val {len(val_df):,} | test {len(test_df):,}"
    )
    # We kept ``val_df`` separate so the user can later add hyper-parameter
    # tuning without contaminating the test set. The minimum-viable run uses
    # fixed sensible hyperparameters (see ``make_logreg_pipeline``/``make_xgb``).
    # 验证集当前不参与训练,保留下来是为了以后安全地做超参数调优。

    rows: list[EvalRow] = []
    pred_records: list[dict] = []
    for model_name in ("lr", "xgb"):
        for imbalance in ("none", "class_weight", "smote"):
            print(f"\n>> training {model_name.upper()} | imbalance={imbalance}")
            row, proba = train_one(model_name, imbalance, train_df, test_df)
            rows.append(row)
            for p, y, mid in zip(proba, test_df[LABEL].to_numpy(), test_df["match_id"].to_numpy()):
                pred_records.append(
                    {
                        "model": model_name,
                        "imbalance": imbalance,
                        "match_id": int(mid),
                        "y_true": int(y),
                        "y_proba": float(p),
                    }
                )
            print(
                f"   AUC-ROC={row.auc_roc:.3f}  AUC-PR={row.auc_pr:.3f}  "
                f"F1={row.f1:.3f}  Sens={row.sensitivity:.3f}  Spec={row.specificity:.3f}"
            )

    metrics_df = metrics_dataframe(rows)
    # Persist both summary metrics and per-shot probabilities.
    # 保存汇总指标和逐射门预测概率,后者用于画 ROC 曲线。
    metrics_df.to_csv(RESULTS_DIR / "metrics.csv", index=False)
    pd.DataFrame(pred_records).to_csv(RESULTS_DIR / "predictions.csv", index=False)
    (RESULTS_DIR / "results_table.tex").write_text(latex_results_table(metrics_df), encoding="utf-8")
    (RESULTS_DIR / "split_sizes.json").write_text(
        json.dumps(
            {"train": len(train_df), "val": len(val_df), "test": len(test_df)},
            indent=2,
        ),
        encoding="utf-8",
    )

    print("\n=== Final test-set metrics ===")
    print(metrics_df.to_string(index=False, float_format=lambda v: f"{v:.3f}"))

    print("\n=== XGBoost feature importance (refit on full train) ===")
    save_xgb_feature_importance(train_df)
    print(f"\nWrote results to {RESULTS_DIR.resolve()}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--shots",
        default=str(DATA_DIR / "shots.csv"),
        help="path to the prepared shots.csv (default: ../data/shots.csv)",
    )
    args = parser.parse_args()
    main(Path(args.shots))
