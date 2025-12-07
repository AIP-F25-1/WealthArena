# redditData/reddit_metrics_asx_raw.py
import csv, json
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path("redditData")
RAW_GLOB = "reddit_asx_raw_*_last*d.jsonl"

def load_latest_raw_jsonl() -> Path:
    files = sorted(BASE_DIR.glob(RAW_GLOB))
    if not files:
        raise FileNotFoundError("No raw reddit jsonl found. Run reddit_scrape_asx_raw.py first.")
    return files[-1]

def main():
    path = load_latest_raw_jsonl()
    print(f"Metrics from: {path.name}")

    # per-subreddit aggregations
    agg = defaultdict(lambda: {
        "posts": 0,
        "unique_authors": set(),
        "total_score": 0,
        "total_comments": 0,
        "text_posts": 0,
        "link_posts": 0,
        "over18_posts": 0,
        "first_seen_utc": None,
        "last_seen_utc": None,
    })

    with path.open("r", encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            sub = r.get("subreddit", "") or ""
            a = agg[sub]

            a["posts"] += 1
            a["unique_authors"].add(r.get("author", "") or "")
            a["total_score"] += int(r.get("score_likes", 0) or 0)
            a["total_comments"] += int(r.get("num_comments", 0) or 0)

            ctype = (r.get("content_type") or "").lower()
            if ctype == "text":
                a["text_posts"] += 1
            else:
                a["link_posts"] += 1

            if r.get("over_18"):
                a["over18_posts"] += 1

            ts = r.get("created_utc") or ""
            # update first/last (lex sort works with ISO-8601)
            if ts:
                if a["first_seen_utc"] is None or ts < a["first_seen_utc"]:
                    a["first_seen_utc"] = ts
                if a["last_seen_utc"] is None or ts > a["last_seen_utc"]:
                    a["last_seen_utc"] = ts

    # output a single CSV alongside the raw file
    stem = path.name.replace(".jsonl", "")
    out_path = BASE_DIR / f"{stem}_metrics_by_subreddit.csv"

    fields = [
        "subreddit",
        "posts",
        "unique_authors",
        "total_score",
        "avg_score",
        "total_comments",
        "avg_comments",
        "text_posts",
        "link_posts",
        "over18_posts",
        "first_seen_utc",
        "last_seen_utc",
    ]

    with out_path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(fields)

        for sub, a in sorted(agg.items(), key=lambda x: x[0].lower()):
            posts = a["posts"] or 1  # avoid div-by-zero (won't happen but safe)
            avg_score = round(a["total_score"] / posts, 2)
            avg_comments = round(a["total_comments"] / posts, 2)

            w.writerow([
                sub,
                a["posts"],
                max(0, len(a["unique_authors"]) - (1 if "" in a["unique_authors"] else 0)),
                a["total_score"],
                avg_score,
                a["total_comments"],
                avg_comments,
                a["text_posts"],
                a["link_posts"],
                a["over18_posts"],
                a["first_seen_utc"] or "",
                a["last_seen_utc"] or "",
            ])

    print(f"✅ Metrics saved: {out_path.name}")

if __name__ == "__main__":
    main()
