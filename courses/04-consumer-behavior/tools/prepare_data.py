# -*- coding: utf-8 -*-
"""스팀 리뷰 원본(JSON)을 익명화·경량화해 수업용 데이터셋으로 만든다.

원본에는 steamid, personaname, profile_url, avatar 같은 식별정보가 들어 있다.
공개 저장소에 그대로 올릴 수 없으므로 분석에 필요한 필드만 남긴다.

사용법:  python tools/prepare_data.py
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
RAW = HERE / "data" / "_raw"
OUT = HERE / "data"

GAMES = [
    {"file": "counter-strike-2", "appid": 730, "name": "Counter-Strike 2",
     "note": "무료 경쟁형 FPS. 장기 플레이어 비중이 높다."},
    {"file": "cyberpunk-2077", "appid": 1091500, "name": "Cyberpunk 2077",
     "note": "출시 초기 품질 논란 후 평가가 회복된 대표 사례."},
    {"file": "pubg", "appid": 578080, "name": "PUBG: BATTLEGROUNDS",
     "note": "국내 개발 배틀로얄. 리뷰 수가 압도적으로 많다."},
    {"file": "elden-ring", "appid": 1245620, "name": "ELDEN RING",
     "note": "높은 난이도에도 만족도가 높은 사례."},
]

# 남길 리뷰 필드 (개인 식별 정보 제외)
KEEP = ["voted_up", "votes_up", "votes_funny", "weighted_vote_score",
        "comment_count", "timestamp_created", "steam_purchase",
        "received_for_free", "written_during_early_access", "primarily_steam_deck"]

# 남길 작성자 필드 (익명 통계값만)
KEEP_AUTHOR = ["num_games_owned", "num_reviews", "playtime_forever",
               "playtime_at_review"]


def clean(review):
    out = {k: review.get(k) for k in KEEP}
    author = review.get("author", {})
    out["author"] = {k: author.get(k) for k in KEEP_AUTHOR}
    text = (review.get("review") or "").strip()
    out["review"] = text
    out["review_len"] = len(text)
    try:
        out["weighted_vote_score"] = round(float(out["weighted_vote_score"] or 0), 4)
    except (TypeError, ValueError):
        out["weighted_vote_score"] = 0.0
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    for game in GAMES:
        src = RAW / f"{game['file']}.json"
        if not src.exists():
            print(f"  건너뜀 (원본 없음): {src.name}")
            continue
        raw = json.loads(src.read_text(encoding="utf-8"))
        summary = raw.get("query_summary", {})
        reviews = [clean(r) for r in raw.get("reviews", [])]
        payload = {
            "appid": game["appid"],
            "name": game["name"],
            "note": game["note"],
            "language": "koreana",
            "collected_at": "2026-08-23",
            "summary": {
                "total_reviews": summary.get("total_reviews"),
                "total_positive": summary.get("total_positive"),
                "total_negative": summary.get("total_negative"),
                "review_score_desc": summary.get("review_score_desc"),
            },
            "sample_size": len(reviews),
            "reviews": reviews,
        }
        dest = OUT / f"{game['file']}.json"
        dest.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
        index.append({"file": f"{game['file']}.json", "appid": game["appid"],
                      "name": game["name"], "note": game["note"],
                      "sample_size": len(reviews)})
        print(f"  {game['name']:<24} {len(reviews):>3}건  {dest.stat().st_size/1024:>5.0f} KB")

    (OUT / "index.json").write_text(
        json.dumps({"games": index, "collected_at": "2026-08-23",
                    "source": "Steam Store API - appreviews (language=koreana)"},
                   ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n목록 파일: {OUT / 'index.json'}")


if __name__ == "__main__":
    main()
