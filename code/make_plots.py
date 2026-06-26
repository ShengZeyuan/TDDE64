"""Produce the figures that the LaTeX report references.

生成 LaTeX 报告中引用的图表。

Reads ``results/predictions.csv`` and ``results/feature_importance.csv``
(produced by ``train_eval.py``) and writes:
    - ``figures/roc_curves.pdf``
    - ``figures/feature_importance.pdf``
    - ``figures/eda_distance_angle.pdf``  (extra, useful for the report)
"""
from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import roc_curve

from utils import DATA_DIR, FIGURES_DIR, RESULTS_DIR

plt.rcParams.update(
    {
        "figure.dpi": 110,
        "savefig.dpi": 200,
        "font.size": 11,
        "axes.spines.top": False,
        "axes.spines.right": False,
    }
)

# Display names used in plot legends.
# 图例中展示的模型和不平衡处理名称。
MODEL_LABELS = {"lr": "Logistic Regression", "xgb": "XGBoost"}
IMBAL_LABELS = {"none": "none", "class_weight": "class weight", "smote": "SMOTE"}


def plot_roc_curves(predictions: pd.DataFrame, out: Path) -> None:
    """Overlay ROC curves for every (model, imbalance) configuration.

    为每个模型配置绘制 ROC 曲线,用于比较不同阈值下的判别能力。
    """
    fig, ax = plt.subplots(figsize=(6, 5))
    for (model, imbalance), grp in predictions.groupby(["model", "imbalance"]):
        # ROC uses the full probability ranking, so it is threshold-independent.
        # ROC 使用完整概率排序,因此不依赖固定分类阈值。
        fpr, tpr, _ = roc_curve(grp["y_true"], grp["y_proba"])
        label = f"{MODEL_LABELS[model]} ({IMBAL_LABELS[imbalance]})"
        ax.plot(fpr, tpr, label=label, linewidth=1.6)
    ax.plot([0, 1], [0, 1], "--", color="grey", linewidth=1)
    ax.set_xlabel("False positive rate")
    ax.set_ylabel("True positive rate")
    ax.set_title("ROC curves on the held-out test set")
    ax.legend(loc="lower right", fontsize=9)
    fig.tight_layout()
    fig.savefig(out)
    plt.close(fig)
    print(f"  wrote {out}")


def plot_feature_importance(fi: pd.DataFrame, out: Path) -> None:
    """Horizontal bar chart of XGBoost gain importances.

    绘制 XGBoost 的 gain 特征重要性横向柱状图。
    """
    fi = fi.sort_values("gain", ascending=True).tail(15)
    fig, ax = plt.subplots(figsize=(6, 4))
    ax.barh(fi["feature"], fi["gain"], color="#3a7ca5")
    ax.set_xlabel("Gain")
    ax.set_title("XGBoost feature importance (gain)")
    fig.tight_layout()
    fig.savefig(out)
    plt.close(fig)
    print(f"  wrote {out}")


def _binned_rate(values: pd.Series, label: pd.Series, bins: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Return (centre, goal_rate) arrays aligned to ``bins`` (including empties).

    按区间分箱计算平均进球率,并返回每个区间中心点和对应进球率。
    """
    cats = pd.cut(values, bins, include_lowest=True)
    rates = label.groupby(cats, observed=False).mean().reindex(cats.cat.categories)
    centres = (bins[:-1] + bins[1:]) / 2
    return centres, rates.to_numpy()


def plot_eda(shots: pd.DataFrame, out: Path) -> None:
    """EDA plot: goal rate vs distance and vs angle.

    生成探索性图表:进球率如何随射门距离和可见球门角度变化。
    """
    fig, axes = plt.subplots(1, 2, figsize=(10, 4))
    # Distance plot: farther shots should empirically have lower conversion.
    # 距离图:射门距离越远,经验进球率通常越低。
    bins_d = np.linspace(0, 40, 21)
    centres_d, rates_d = _binned_rate(shots["distance"], shots["is_goal"], bins_d)
    axes[0].plot(centres_d, rates_d, "o-", color="#c0392b")
    axes[0].set_xlabel("Distance to goal (m)")
    axes[0].set_ylabel("Goal rate")
    axes[0].set_title("Conversion rate vs. distance")

    # Angle plot: larger visible goal angle usually means a better chance.
    # 角度图:可见球门角度越大,通常机会质量越高。
    bins_a = np.linspace(0, np.pi, 16)
    centres_a, rates_a = _binned_rate(shots["angle"], shots["is_goal"], bins_a)
    axes[1].plot(np.degrees(centres_a), rates_a, "o-", color="#2c7a7b")
    axes[1].set_xlabel("Visible goal angle (deg)")
    axes[1].set_ylabel("Goal rate")
    axes[1].set_title("Conversion rate vs. angle")
    fig.tight_layout()
    fig.savefig(out)
    plt.close(fig)
    print(f"  wrote {out}")


def main() -> None:
    """Create all report figures from saved model outputs.

    从训练输出文件生成报告所需的所有 PDF 图。
    """
    pred_path = RESULTS_DIR / "predictions.csv"
    fi_path = RESULTS_DIR / "feature_importance.csv"
    if not pred_path.exists() or not fi_path.exists():
        raise SystemExit("results files missing -- run train_eval.py first")

    print("Plotting ...")
    predictions = pd.read_csv(pred_path)
    fi = pd.read_csv(fi_path)
    plot_roc_curves(predictions, FIGURES_DIR / "roc_curves.pdf")
    plot_feature_importance(fi, FIGURES_DIR / "feature_importance.pdf")

    shots_path = DATA_DIR / "shots.csv"
    if shots_path.exists():
        shots = pd.read_csv(shots_path)
        plot_eda(shots, FIGURES_DIR / "eda_distance_angle.pdf")
    else:
        print("  [skip] eda plot (shots.csv missing)")


if __name__ == "__main__":
    main()
