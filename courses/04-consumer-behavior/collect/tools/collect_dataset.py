# -*- coding: utf-8 -*-
"""수업 시연용 데이터셋을 만든다.

브라우저와 달리 파이썬에서는 CORS 제한이 없어 스팀 API 를 직접 부를 수 있다.
커서로 여러 묶음을 이어 받고, 작성자 계정 정보를 걷어낸 뒤 저장한다.

사용법:  python tools/collect_dataset.py
"""
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
OUT = HERE / "analysis" / "data"

GAMES = [
    {"file": "cyberpunk-2077", "appid": 1091500, "name": "Cyberpunk 2077",
     "note": "2020년 출시 직후 품질 논란으로 환불 사태를 겪고, 이후 패치와 확장팩으로 평가가 회복된 사례."},
    {"file": "pubg", "appid": 578080, "name": "PUBG: BATTLEGROUNDS",
     "note": "국내 개발 배틀로얄. 무료 전환 이후 신규 이용자와 장기 이용자의 평가가 갈린다."},
    {"file": "elden-ring", "appid": 1245620, "name": "ELDEN RING",
     "note": "높은 난이도에도 만족도가 높다. 어려움이 곧 불만이 되지는 않는다는 사례."},
    {"file": "counter-strike-2", "appid": 730, "name": "Counter-Strike 2",
     "note": "전작을 대체하며 출시. 오래 플레이한 이용자일수록 평가가 박해지는 경향을 본다."},
]

TARGET = 600          # 게임당 목표 건수
PER_PAGE = 100
SORT = "all"          # all=유용성순(기간이 넓게 퍼진다), recent=최신순
LANG = "koreana"

KEEP = ["recommendationid", "voted_up", "votes_up", "votes_funny", "weighted_vote_score",
        "comment_count", "timestamp_created", "steam_purchase", "received_for_free",
        "written_during_early_access", "primarily_steam_deck"]
KEEP_AUTHOR = ["num_games_owned", "num_reviews", "playtime_forever", "playtime_at_review"]


def clean(r):
    out = {k: r.get(k) for k in KEEP}
    a = r.get("author", {})
    out["author"] = {k: a.get(k) for k in KEEP_AUTHOR}
    text = (r.get("review") or "").strip()
    out["review"] = text
    out["review_len"] = len(text)
    try:
        out["weighted_vote_score"] = round(float(out["weighted_vote_score"] or 0), 4)
    except (TypeError, ValueError):
        out["weighted_vote_score"] = 0.0
    return out


def fetch(appid, cursor):
    url = (f"https://store.steampowered.com/appreviews/{appid}?json=1"
           f"&language={LANG}&num_per_page={PER_PAGE}&filter={SORT}"
           f"&purchase_type=all&review_type=all&cursor={urllib.parse.quote(cursor, safe='')}")
    req = urllib.request.Request(url, headers={"User-Agent": "yeonsung-consumer-behavior/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def collect(game):
    seen, rows, cursor, summary = set(), [], "*", None
    for page in range(20):  # 커서가 돌 수 있으니 상한을 둔다
        data = fetch(game["appid"], cursor)
        if data.get("success") != 1:
            break
        if summary is None:
            summary = data.get("query_summary") or {}
        batch = data.get("reviews") or []
        if not batch:
            break
        added = 0
        for r in batch:
            rid = r.get("recommendationid")
            if rid in seen:
                continue
            seen.add(rid)
            rows.append(clean(r))
            added += 1
        nxt = data.get("cursor")
        print(f"    {page + 1}쪽: {added}건 추가 (누적 {len(rows)})")
        if len(rows) >= TARGET or not nxt or nxt == cursor or added == 0:
            break
        cursor = nxt
        time.sleep(0.4)  # 스팀 서버에 대한 예의
    return rows[:TARGET], summary or {}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    for g in GAMES:
        print(f"  {g['name']} 수집 중…")
        rows, summary = collect(g)
        payload = {
            "appid": g["appid"], "name": g["name"], "note": g["note"],
            "language": LANG, "sort": SORT, "collected_at": time.strftime("%Y-%m-%d"),
            "summary": {k: summary.get(k) for k in
                        ("total_reviews", "total_positive", "total_negative", "review_score_desc")},
            "sample_size": len(rows), "reviews": rows,
        }
        dest = OUT / f"{g['file']}.json"
        dest.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        index.append({"file": f"{g['file']}.json", "name": g["name"], "note": g["note"],
                      "appid": g["appid"], "sample_size": len(rows)})
        print(f"    -> {len(rows)}건, {dest.stat().st_size / 1024:.0f} KB\n")

    (OUT / "index.json").write_text(
        json.dumps({"games": index, "collected_at": time.strftime("%Y-%m-%d"),
                    "language": LANG, "sort": SORT,
                    "source": "Steam Store API - appreviews"}, ensure_ascii=False, indent=2),
        encoding="utf-8")
    print("목록:", OUT / "index.json")


if __name__ == "__main__":
    main()
