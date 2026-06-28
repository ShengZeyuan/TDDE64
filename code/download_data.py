"""Download the Wyscout Open Soccer Match Event Dataset from Figshare.

从 Figshare 下载 Wyscout 开放足球事件数据集。

Reference
---------
Pappalardo, L. et al. (2019). A public data set of spatio-temporal match
events in soccer competitions. Scientific Data 6, 236.
https://doi.org/10.1038/s41597-019-0247-7

Files placed under ``../data/`` (relative to this script):
    events.zip      Article 7770599  (event JSON files)
    matches.zip     Article 7770422  (match metadata JSON files)
    players.json    Article 7770569  (~  3 MB)
    teams.json      Article 7770311  (~ 50 KB)

Each archive is unzipped in place. Existing files are skipped.
每个压缩包会解压到 data 文件夹;如果文件已存在,脚本会自动跳过。
"""
from __future__ import annotations

import argparse
import sys
import zipfile
from pathlib import Path

import requests
from tqdm import tqdm

from utils import DATA_DIR

# Figshare exposes article files through this API endpoint.
# Figshare 通过该 API 端点暴露每个 article 下面的文件列表。
FIGSHARE_API = "https://api.figshare.com/v2/articles/{article_id}/files"

# Only events and matches are required by this project.
# 本项目只需要事件数据和比赛元数据,不依赖球员/球队额外信息。
ARTICLES = {
    "events": 7770599,
    "matches": 7770422,
}

# 这个脚本的职责很单一:
# 1. 通过 Figshare API 找到 article 下面真实可下载的文件;
# 2. 把 zip 包和 JSON 文件下载到 data 目录;
# 3. 如果下载的是 zip,就在本地立即解压。
# 它不负责做任何数据清洗和建模,只负责把原始数据准备齐。


def list_files(article_id: int) -> list[dict]:
    """Return the list of file metadata dicts for one Figshare article.

    获取某个 Figshare article 下所有文件的元数据,包括下载链接。
    """
    url = FIGSHARE_API.format(article_id=article_id)
    response = requests.get(url, timeout=60)
    response.raise_for_status()
    return response.json()


def download_file(url: str, dest: Path) -> None:
    """Stream-download a single file with a tqdm progress bar.

    分块下载单个文件并显示进度条,避免一次性把大文件读入内存。
    """
    if dest.exists() and dest.stat().st_size > 0:
        # Existing non-empty files are treated as complete downloads.
        # 已存在且非空的文件视为已下载完成,避免重复下载大文件。
        print(f"  [skip] {dest.name} already present ({dest.stat().st_size/1e6:.1f} MB)")
        return
    with requests.get(url, stream=True, timeout=300) as r:
        r.raise_for_status()
        total = int(r.headers.get("content-length", 0))
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as fh, tqdm(
            total=total, unit="B", unit_scale=True, desc=dest.name, ncols=80
        ) as bar:
            for chunk in r.iter_content(chunk_size=1 << 15):
                fh.write(chunk)
                bar.update(len(chunk))


def unzip_in_place(archive: Path, target: Path) -> None:
    """Extract a zip archive into ``target`` if it has not been extracted yet.

    如果压缩包尚未解压,就解压到目标目录;否则跳过。
    """
    target.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(archive) as zf:
        names = zf.namelist()
        already = all((target / n).exists() for n in names)
        if already:
            print(f"  [skip] {archive.name} already extracted")
            return
        print(f"  unzipping {archive.name} ...")
        zf.extractall(target)


def main(only: list[str] | None = None) -> None:
    """Download requested Wyscout data articles.

    下载用户指定的 Wyscout 数据 article;默认下载全部必需数据。
    """
    # 默认把本项目需要的 article 全部拉下来;
    # 如果用户显式指定 --only,就只下载对应部分,方便调试。
    targets = only or list(ARTICLES.keys())
    print(f"Downloading Wyscout open data into: {DATA_DIR.resolve()}")
    for name in targets:
        if name not in ARTICLES:
            print(f"  [warn] unknown target {name!r}; skipping")
            continue
        article_id = ARTICLES[name]
        print(f"\n== {name} (article {article_id}) ==")
        try:
            files = list_files(article_id)
        except requests.HTTPError as exc:
            # Keep the script robust: one unavailable Figshare article should
            # not delete or invalidate files that were already downloaded.
            # 保持脚本鲁棒性:单个 article 失败时,不影响已下载的数据。
            print(f"  [warn] could not list files: {exc} (skipping)")
            continue
        for f in files:
            # Figshare 返回的是文件元数据字典,其中最关键的是:
            # - name: 本地文件名
            # - download_url: 实际下载地址
            dest = DATA_DIR / f["name"]
            download_file(f["download_url"], dest)
            if dest.suffix == ".zip":
                # 原始开放数据往往是压缩包形式,这里下载后直接解压,
                # 这样后续 prepare_data.py 可以直接读取 events_*.json / matches_*.json。
                unzip_in_place(dest, DATA_DIR)
    print("\nAll done. Files are in", DATA_DIR.resolve())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--only",
        nargs="*",
        choices=sorted(ARTICLES.keys()),
        help="Only download these articles (default: all).",
    )
    args = parser.parse_args()
    main(args.only)
