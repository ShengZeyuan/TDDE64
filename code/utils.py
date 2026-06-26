"""Shared utilities: geometry, feature engineering helpers, evaluation.

共享工具: 包括球场几何计算、特征工程辅助函数和模型评估函数。
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    log_loss,
    roc_auc_score,
)

# Standard FIFA pitch dimensions in metres.
# 标准 FIFA 球场尺寸,单位为米。
PITCH_LENGTH_M: float = 105.0
PITCH_WIDTH_M: float = 68.0
GOAL_WIDTH_M: float = 7.32

PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent
DATA_DIR: Path = PROJECT_ROOT / "data"
FIGURES_DIR: Path = PROJECT_ROOT / "figures"
RESULTS_DIR: Path = PROJECT_ROOT / "code" / "results"
DATA_DIR.mkdir(exist_ok=True)
FIGURES_DIR.mkdir(exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def wyscout_xy_to_metres(x_pct: np.ndarray, y_pct: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Convert Wyscout (0..100, 0..100) percentage coordinates to metres.

    Wyscout convention: x grows toward the *attacking* goal, so x=100, y=50
    is the centre of the opponent goal-line for the attacking team.

    将 Wyscout 的百分制坐标转换成真实球场米制坐标。
    Wyscout 的 x 轴总是朝进攻方向增加,因此 x=100, y=50 表示对方球门中心。
    """
    return x_pct / 100.0 * PITCH_LENGTH_M, y_pct / 100.0 * PITCH_WIDTH_M


def shot_distance(x_pct: np.ndarray, y_pct: np.ndarray) -> np.ndarray:
    """Euclidean distance from shot location to the centre of the goal (in metres).

    计算射门点到球门中心的欧氏距离,单位为米。
    """
    x_m, y_m = wyscout_xy_to_metres(x_pct, y_pct)
    return np.sqrt((PITCH_LENGTH_M - x_m) ** 2 + (PITCH_WIDTH_M / 2.0 - y_m) ** 2)


def shot_angle(x_pct: np.ndarray, y_pct: np.ndarray) -> np.ndarray:
    """Angle (radians) subtended by the goal-mouth at the shot location.

    Uses the standard "visible goal width" formula used by Caley (2013) and
    most public xG implementations.

    计算射门点“看到”的球门张角,单位为弧度。
    这是 xG 中最常见的几何特征之一,角度越大通常越容易进球。
    """
    x_m, y_m = wyscout_xy_to_metres(x_pct, y_pct)
    dx = PITCH_LENGTH_M - x_m
    dy = PITCH_WIDTH_M / 2.0 - y_m
    num = GOAL_WIDTH_M * dx
    denom = dx ** 2 + dy ** 2 - (GOAL_WIDTH_M / 2.0) ** 2
    angle = np.arctan2(num, denom)
    # When the ball is *between* the posts the geometric angle wraps round
    # to a negative value; shift it to (0, pi).
    # 如果射门点在两根门柱之间,公式会产生负角度;这里修正到 (0, pi)。
    return np.where(angle < 0, angle + np.pi, angle)


# Wyscout tag IDs (see Pappalardo et al. 2019, Table 4).
# Wyscout 标签编号,来源见 Pappalardo et al. 2019 的标签表。
TAG_GOAL = 101
TAG_OWN_GOAL = 102
TAG_LEFT_FOOT = 401
TAG_RIGHT_FOOT = 402
TAG_HEAD_OR_BODY = 403
TAG_ACCURATE = 1801


def has_tag(tags: Iterable[dict], target_id: int) -> bool:
    """Return True if any tag in the Wyscout tag list has id == target_id.

    判断一个事件的标签列表中是否包含指定 tag id。
    """
    if tags is None:
        return False
    for t in tags:
        if isinstance(t, dict) and t.get("id") == target_id:
            return True
    return False


@dataclass
class EvalRow:
    """One row of the discrimination metrics table.

    保存某一个模型配置在测试集上的一行评估结果。
    """

    model: str
    imbalance: str
    auc_roc: float
    auc_pr: float
    f1: float
    sensitivity: float
    specificity: float
    log_loss: float

    def as_dict(self) -> dict:
        return {
            "model": self.model,
            "imbalance": self.imbalance,
            "auc_roc": self.auc_roc,
            "auc_pr": self.auc_pr,
            "f1": self.f1,
            "sensitivity": self.sensitivity,
            "specificity": self.specificity,
            "log_loss": self.log_loss,
        }


def evaluate_predictions(
    y_true: np.ndarray,
    y_proba: np.ndarray,
    model: str,
    imbalance: str,
    threshold: float = 0.5,
) -> EvalRow:
    """Compute discrimination metrics at the given decision threshold.

    根据预测概率计算 AUC、F1、敏感度、特异度和 log-loss。
    threshold 只影响 F1/sensitivity/specificity,不影响 AUC。
    """
    y_pred = (y_proba >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    sens = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    return EvalRow(
        model=model,
        imbalance=imbalance,
        auc_roc=roc_auc_score(y_true, y_proba),
        auc_pr=average_precision_score(y_true, y_proba),
        f1=f1_score(y_true, y_pred, zero_division=0),
        sensitivity=sens,
        specificity=spec,
        log_loss=log_loss(y_true, np.clip(y_proba, 1e-7, 1 - 1e-7)),
    )


def metrics_dataframe(rows: list[EvalRow]) -> pd.DataFrame:
    """Convert metric rows into a dataframe.

    将多个 EvalRow 结果转换为 pandas DataFrame,方便保存为 CSV。
    """
    return pd.DataFrame([r.as_dict() for r in rows])


def latex_results_table(df: pd.DataFrame) -> str:
    """Render the metrics dataframe as a booktabs-style LaTeX table body.

    The returned string ends with a trailing newline; required by some
    LaTeX setups when the body is consumed via ``\\input``.

    将指标表转换成 LaTeX booktabs 表格的主体部分。
    末尾保留换行,避免某些 LaTeX 环境在 ``\\input`` 时解析失败。
    """
    cols = ["auc_roc", "auc_pr", "f1", "sensitivity", "specificity"]
    lines = []
    for _, row in df.iterrows():
        imbalance = str(row["imbalance"]).replace("_", r"\_")
        cells = [f"{row['model']}", imbalance]
        cells += [f"{row[c]:.3f}" for c in cols]
        lines.append(" & ".join(cells) + " \\\\")
    return "\n".join(lines) + "\n"
