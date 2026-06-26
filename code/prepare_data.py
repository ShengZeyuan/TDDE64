"""Extract shot events from the Wyscout JSON files and engineer features.

从 Wyscout JSON 文件中提取射门事件,并构造 xG 模型所需的特征。

Outputs ``../data/shots.csv`` with one row per shot and these columns:
    match_id, competition, period, minute, team_id,
    x, y, distance, angle,
    body_foot, body_head,
    is_free_kick,
    score_diff,                # team score minus opponent score at shot time
    is_goal                    # binary label
Penalties are excluded (they are deterministic at xG ~ 0.76).
点球被排除,因为点球的进球概率相对固定,会干扰普通射门模型。
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from utils import (
    DATA_DIR,
    TAG_GOAL,
    TAG_HEAD_OR_BODY,
    TAG_LEFT_FOOT,
    TAG_RIGHT_FOOT,
    has_tag,
    shot_angle,
    shot_distance,
)

# Mapping from competition name to its event JSON file.
# 赛事名称到事件 JSON 文件名的映射。
EVENT_FILES = {
    "England": "events_England.json",
    "Spain": "events_Spain.json",
    "Italy": "events_Italy.json",
    "Germany": "events_Germany.json",
    "France": "events_France.json",
    "World_Cup": "events_World_Cup.json",
    "Euro": "events_European_Championship.json",
}
# Mapping from competition name to its match metadata JSON file.
# 赛事名称到比赛元数据 JSON 文件名的映射。
MATCH_FILES = {
    "England": "matches_England.json",
    "Spain": "matches_Spain.json",
    "Italy": "matches_Italy.json",
    "Germany": "matches_Germany.json",
    "France": "matches_France.json",
    "World_Cup": "matches_World_Cup.json",
    "Euro": "matches_European_Championship.json",
}


def load_match_index(path: Path) -> dict[int, dict[int, str]]:
    """Build {match_id: {team_id: 'home'|'away'}} for one competition.

    构建比赛索引:给定 match_id,可以查到每支球队是主队还是客队。
    当前 pipeline 主要用它确认一场比赛中有哪些 team_id。
    """
    with open(path, "r", encoding="utf-8") as fh:
        matches = json.load(fh)
    index: dict[int, dict[int, str]] = {}
    for m in matches:
        sides: dict[int, str] = {}
        for team_id, info in m.get("teamsData", {}).items():
            sides[int(team_id)] = info.get("side", "home")
        index[m["wyId"]] = sides
    return index


def extract_shots_one_competition(
    events_path: Path,
    matches_idx: dict[int, dict[int, str]],
    competition: str,
) -> pd.DataFrame:
    """Stream the events JSON and return a tidy shot dataframe.

    读取单个赛事的事件文件,筛选射门事件,并返回整洁的 shot-level 表。
    """
    print(f"  loading {events_path.name} ...")
    with open(events_path, "r", encoding="utf-8") as fh:
        events = json.load(fh)
    print(f"    {len(events):,} events")

    # Pre-compute running scores per match by walking the events in order.
    # Wyscout events come pre-sorted by (matchId, matchPeriod, eventSec);
    # we trust that ordering but stable-sort just in case.
    # 按比赛和时间排序,这样可以逐事件更新实时比分,用于 score_diff 特征。
    df = pd.DataFrame(events)
    df = df.sort_values(["matchId", "matchPeriod", "eventSec"], kind="stable").reset_index(drop=True)

    # ``goalScored`` flag for every event (goal => Shot/Free kick shot with
    # tag 101, OR an own-goal Save attempt etc. -- handled below).
    # 标记所有导致进球的事件;后面遍历比赛时用它更新实时比分。
    is_goal_event = df.apply(
        lambda r: has_tag(r["tags"], TAG_GOAL) and r["eventName"] in {"Shot", "Free Kick", "Save attempt"},
        axis=1,
    )

    # Walk the dataframe match-by-match to compute the score difference for
    # each shot at the moment it was taken (BEFORE the goal counts).
    # 逐场比赛遍历事件,在射门发生前记录当前比分差,避免把这次射门的结果泄漏进特征。
    rows: list[dict] = []
    for match_id, sub in df.groupby("matchId", sort=False):
        sides = matches_idx.get(match_id)
        if not sides:
            continue
        score: dict[int, int] = {team_id: 0 for team_id in sides}
        for idx, ev in sub.iterrows():
            team_id = ev["teamId"]
            if team_id not in score:
                continue
            opp_ids = [t for t in score if t != team_id]
            opp_id = opp_ids[0] if opp_ids else team_id
            sub_event = ev.get("subEventName", "")
            ev_name = ev.get("eventName", "")
            # Filter to shot-like events; exclude penalties.
            # 只保留普通射门和直接任意球射门;点球不进入训练集。
            is_shot = (
                ev_name == "Shot"
                or sub_event == "Free kick shot"
            )
            if not is_shot or sub_event == "Penalty":
                # Still update the score if this *was* a goal (e.g. penalty).
                # 即使该事件不进入数据集,如果它是进球也必须更新之后的比分。
                if is_goal_event.loc[idx]:
                    score[team_id] += 1
                continue
            positions = ev.get("positions") or []
            if not positions:
                continue
            x = positions[0].get("x")
            y = positions[0].get("y")
            if x is None or y is None:
                continue
            tags = ev["tags"]
            # Wyscout encodes labels and body part through tag IDs.
            # Wyscout 用 tag id 表示进球、脚射、头球等语义信息。
            is_goal = int(has_tag(tags, TAG_GOAL))
            body_foot = int(has_tag(tags, TAG_LEFT_FOOT) or has_tag(tags, TAG_RIGHT_FOOT))
            body_head = int(has_tag(tags, TAG_HEAD_OR_BODY))
            score_diff = score[team_id] - score[opp_id]
            rows.append(
                {
                    "match_id": match_id,
                    "competition": competition,
                    "period": ev["matchPeriod"],
                    "minute": ev["eventSec"] / 60.0,
                    "team_id": team_id,
                    "x": x,
                    "y": y,
                    "body_foot": body_foot,
                    "body_head": body_head,
                    "is_free_kick": int(sub_event == "Free kick shot"),
                    "score_diff": score_diff,
                    "is_goal": is_goal,
                }
            )
            if is_goal:
                # Update score only after saving this shot row, because the
                # model must know the score before the shot, not after it.
                # 先保存射门特征,再更新比分;否则会出现目标泄漏。
                score[team_id] += 1
    out = pd.DataFrame(rows)
    print(f"    extracted {len(out):,} shots ({out['is_goal'].mean()*100:.1f}% goals)")
    return out


def add_geometric_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add distance and angle to the goal.

    增加两个核心 xG 几何特征:射门距离和可见球门角度。
    """
    df = df.copy()
    df["distance"] = shot_distance(df["x"].to_numpy(), df["y"].to_numpy())
    df["angle"] = shot_angle(df["x"].to_numpy(), df["y"].to_numpy())
    return df


def main() -> None:
    """Run the full preparation pipeline and write ``shots.csv``.

    运行完整数据准备流程,把所有赛事合并成一个 shot-level CSV 文件。
    """
    all_shots: list[pd.DataFrame] = []
    for comp, ev_name in EVENT_FILES.items():
        ev_path = DATA_DIR / ev_name
        match_path = DATA_DIR / MATCH_FILES[comp]
        if not ev_path.exists() or not match_path.exists():
            print(f"[skip] {comp}: missing {ev_path.name} or {match_path.name}")
            continue
        print(f"\n== {comp} ==")
        idx = load_match_index(match_path)
        df = extract_shots_one_competition(ev_path, idx, comp)
        all_shots.append(df)
    if not all_shots:
        print("\nNo data found. Run download_data.py first.")
        return
    shots = pd.concat(all_shots, ignore_index=True)
    shots = add_geometric_features(shots)
    # Sanity filter: shots must be on the attacking half-ish.
    # 简单质量检查:射门通常应位于进攻半场附近,过滤明显异常坐标。
    shots = shots[shots["x"].between(40, 100) & shots["y"].between(0, 100)].reset_index(drop=True)
    out_path = DATA_DIR / "shots.csv"
    shots.to_csv(out_path, index=False)
    print(f"\nWrote {len(shots):,} shots to {out_path.resolve()}")
    print(f"  overall goal rate: {shots['is_goal'].mean()*100:.2f}%")
    print("  per-competition breakdown:")
    summary = shots.groupby("competition").agg(
        n_shots=("is_goal", "size"),
        goal_rate=("is_goal", "mean"),
    )
    print(summary.to_string(float_format=lambda v: f"{v:.3f}"))
    summary.to_csv(DATA_DIR / "shots_summary.csv")


if __name__ == "__main__":
    main()
