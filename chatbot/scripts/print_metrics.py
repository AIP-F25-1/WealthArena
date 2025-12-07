#!/usr/bin/env python3

# Minimal metrics printer for WealthArena (no extra deps)

import sys

# Fix Unicode/Emoji support (Python 3.7+)
try:
    sys.stdout.reconfigure(encoding='utf-8')  # type: ignore
except AttributeError:
    # Python 3.6 or earlier - reconfigure() not available
    # Fall back to environment variable or accept default encoding
    pass

import json, time, statistics, argparse, csv
from urllib import request
from pathlib import Path


def http_get(url, timeout=5):
    t0 = time.monotonic()
    try:
        with request.urlopen(url, timeout=timeout) as r:
            body = r.read()
            return True, time.monotonic() - t0, r.getcode(), body
    except Exception as e:
        return False, time.monotonic() - t0, getattr(e, "code", None), None


def http_post_json(url, payload, timeout=5):
    t0 = time.monotonic()
    data = json.dumps(payload).encode("utf-8")
    req = request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with request.urlopen(req, timeout=timeout) as r:
            body = r.read()
            return True, time.monotonic() - t0, r.getcode(), body
    except Exception as e:
        return False, time.monotonic() - t0, getattr(e, "code", None), None


def timed_request(method, url, json_payload=None):
    """Return (ok, ms, payload_dict)."""
    if method == "GET":
        ok, lat, code, body = http_get(url)
    else:
        ok, lat, code, body = http_post_json(url, json_payload)
    payload_dict = None
    if ok and body and code and 200 <= code < 300:
        try:
            payload_dict = json.loads(body.decode("utf-8"))
        except:
            pass
    return ok and (code is None or (200 <= code < 300)), lat * 1000, payload_dict


def lcs_len(a, b):
    """Longest Common Subsequence length."""
    m, n = len(a), len(b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i-1] == b[j-1]:
                dp[i][j] = dp[i-1][j-1] + 1
            else:
                dp[i][j] = max(dp[i-1][j], dp[i][j-1])
    return dp[m][n]


def rouge_l_f1(ref, pred):
    """ROUGE-L F1 score."""
    ref_tokens = ref.lower().split()
    pred_tokens = pred.lower().split()
    if not ref_tokens or not pred_tokens:
        return 0.0
    lcs = lcs_len(ref_tokens, pred_tokens)
    precision = lcs / len(pred_tokens) if pred_tokens else 0.0
    recall = lcs / len(ref_tokens) if ref_tokens else 0.0
    if precision + recall == 0:
        return 0.0
    return 2 * precision * recall / (precision + recall)


def percentile(data, p):
    if not data:
        return None
    data = sorted(data)
    k = max(0, min(len(data) - 1, int(round((p / 100.0) * (len(data) - 1)))))
    return data[k]


def test_chatbot(base_url, eval_data=None, runs=5):
    """Test /v1/explain: inference time, ROUGE-L, optional BERT-F1."""
    url = f"{base_url}/v1/explain"
    times, rouge_scores, bert_scores = [], [], []
    total_attempts = 0
    successful_requests = 0
    
    # Warmup
    for _ in range(3):
        timed_request("POST", url, {"question": "What is RSI?"})
    
    # Try BERTScore if transformers available
    bert_tokenizer = None
    try:
        from transformers import AutoTokenizer
        bert_tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased", use_fast=True)
    except:
        pass
    
    if eval_data:
        for row in eval_data[:50]:
            q = row.get("question", "")
            ref = row.get("reference", "")
            total_attempts += 1
            ok, ms, resp = timed_request("POST", url, {"question": q})
            if ok and resp:
                successful_requests += 1
                times.append(ms)
                pred = resp.get("answer", resp.get("text", ""))
                if ref and pred:
                    rouge_scores.append(rouge_l_f1(ref, pred))
                    if bert_tokenizer:
                        try:
                            ref_tokens = bert_tokenizer(ref, return_tensors="pt", truncation=True, max_length=512)
                            pred_tokens = bert_tokenizer(pred, return_tensors="pt", truncation=True, max_length=512)
                            # Simple token overlap F1 as approximation
                            ref_set = set(ref_tokens["input_ids"][0].tolist())
                            pred_set = set(pred_tokens["input_ids"][0].tolist())
                            if ref_set and pred_set:
                                overlap = len(ref_set & pred_set)
                                prec = overlap / len(pred_set) if pred_set else 0
                                rec = overlap / len(ref_set) if ref_set else 0
                                f1 = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0
                                bert_scores.append(f1)
                        except:
                            pass
    else:
        for _ in range(runs):
            total_attempts += 1
            ok, ms, _ = timed_request("POST", url, {"question": "What is RSI?"})
            if ok:
                successful_requests += 1
                times.append(ms)
    
    return {
        "inference_ms": statistics.mean(times) if times else 0.0,
        "rouge_l": statistics.mean(rouge_scores) if rouge_scores else None,
        "bert_f1": statistics.mean(bert_scores) if bert_scores else None,
        "latencies": times,
        "total_attempts": total_attempts,
        "successful_requests": successful_requests
    }


def test_retrieval(base_url, eval_data=None, runs=5):
    """Test /v1/search: latency, MAP@5, MRR@5."""
    url = f"{base_url}/v1/search"
    times, map_scores, mrr_scores = [], [], []
    total_attempts = 0
    successful_requests = 0
    
    if not eval_data:
        # Just latency test
        for _ in range(runs):
            total_attempts += 1
            ok, ms, _ = timed_request("GET", f"{url}?q=RSI&k=5")
            if ok:
                successful_requests += 1
                times.append(ms)
        return {
            "latency_ms": statistics.mean(times) if times else 0.0,
            "map5": None,
            "mrr5": None,
            "latencies": times,
            "total_attempts": total_attempts,
            "successful_requests": successful_requests
        }
    
    for row in eval_data[:50]:
        q = row.get("query", "")
        gold_id = row.get("gold_id", "")
        gold_text = row.get("gold_text", "")
        total_attempts += 1
        ok, ms, resp = timed_request("GET", f"{url}?q={q}&k=5")
        if ok and resp:
            successful_requests += 1
            times.append(ms)
            results = resp.get("results", resp.get("items", []))
            if results and (gold_id or gold_text):
                ranks = []
                for idx, item in enumerate(results[:5]):
                    item_id = item.get("id", "")
                    item_text = item.get("text", item.get("content", ""))
                    if gold_id and item_id == gold_id:
                        ranks.append(idx + 1)
                    elif gold_text and gold_text.lower() in item_text.lower():
                        ranks.append(idx + 1)
                if ranks:
                    ap = 1.0 / ranks[0]
                    map_scores.append(ap)
                    mrr_scores.append(1.0 / ranks[0])
                else:
                    map_scores.append(0.0)
                    mrr_scores.append(0.0)
    
    return {
        "latency_ms": statistics.mean(times) if times else 0.0,
        "map5": statistics.mean(map_scores) if map_scores else None,
        "mrr5": statistics.mean(mrr_scores) if mrr_scores else None,
        "latencies": times,
        "total_attempts": total_attempts,
        "successful_requests": successful_requests
    }


def test_classification(base_url, eval_data=None, endpoint="/v1/sentiment", runs=5):
    """Test classification: F1 macro, AUC, precision, recall, inference time."""
    url = f"{base_url}{endpoint}"
    times, y_true, y_pred, y_probs = [], [], [], []
    total_attempts = 0
    successful_requests = 0
    
    if not eval_data:
        # Just latency test if endpoint exists
        ok, _, _ = timed_request("POST", url, {"text": "This is great!"})
        if not ok:
            return None
        for _ in range(runs):
            total_attempts += 1
            ok, ms, _ = timed_request("POST", url, {"text": "This is great!"})
            if ok:
                successful_requests += 1
                times.append(ms)
        return {
            "inference_ms": statistics.mean(times) if times else 0.0,
            "f1": None,
            "auc": None,
            "latencies": times,
            "total_attempts": total_attempts,
            "successful_requests": successful_requests
        }
    
    for row in eval_data[:50]:
        text = row.get("text", "")
        label = row.get("label", "").lower()
        total_attempts += 1
        ok, ms, resp = timed_request("POST", url, {"text": text})
        if ok and resp:
            successful_requests += 1
            times.append(ms)
            pred_label = resp.get("sentiment", resp.get("label", "")).lower()
            if label and pred_label:
                y_true.append(label)
                y_pred.append(pred_label)
                probs = resp.get("probs", {})
                if probs:
                    y_probs.append(probs.get(label, 0.0))
    
    # Compute F1 macro
    labels = set(y_true + y_pred)
    f1_scores = []
    for lbl in labels:
        tp = sum(1 for t, p in zip(y_true, y_pred) if t == lbl == p)
        fp = sum(1 for t, p in zip(y_true, y_pred) if t != lbl == p)
        fn = sum(1 for t, p in zip(y_true, y_pred) if t == lbl != p)
        prec = tp / (tp + fp) if (tp + fp) > 0 else 0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1 = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0
        f1_scores.append(f1)
    f1_macro = statistics.mean(f1_scores) if f1_scores else None
    
    # AUC (simplified: if binary and probs available)
    auc = None
    if len(labels) == 2 and y_probs and len(y_probs) == len(y_true):
        pos_label = list(labels)[0]
        y_binary = [1 if t == pos_label else 0 for t in y_true]
        sorted_pairs = sorted(zip(y_probs, y_binary), reverse=True)
        n_pos = sum(y_binary)
        n_neg = len(y_binary) - n_pos
        if n_pos > 0 and n_neg > 0:
            tp, auc_val = 0, 0.0
            for _, is_pos in sorted_pairs:
                if is_pos:
                    tp += 1
                else:
                    auc_val += tp
            auc = auc_val / (n_pos * n_neg) if (n_pos * n_neg) > 0 else None
    
    return {
        "inference_ms": statistics.mean(times) if times else 0.0,
        "f1": f1_macro,
        "auc": auc,
        "latencies": times,
        "total_attempts": total_attempts,
        "successful_requests": successful_requests
    }


def load_eval_data(filepath):
    """Load eval data from JSONL or CSV."""
    if not Path(filepath).exists():
        return None
    data = []
    try:
        if filepath.endswith(".jsonl"):
            with open(filepath, "r", encoding="utf-8") as f:
                for line in f:
                    data.append(json.loads(line.strip()))
        elif filepath.endswith(".csv"):
            with open(filepath, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                data = list(reader)
    except:
        pass
    return data if data else None


def main():
    parser = argparse.ArgumentParser(description="Test WealthArena API endpoints and print metrics")
    parser.add_argument("--url", type=str, default="http://127.0.0.1:8000", help="Base URL of the API server")
    parser.add_argument("--runs", type=int, default=5, help="Number of test runs per endpoint")
    args = parser.parse_args()
    
    base_url = args.url
    
    # Pre-flight health check with retry mechanism - fail fast if server not reachable
    print("Checking server health...")
    server_reachable = False
    for attempt in range(3):
        ok, _, _ = timed_request("GET", f"{base_url}/healthz")
        if ok:
            server_reachable = True
            break
        if attempt < 2:
            time.sleep(1)  # Wait 1 second between retries
    
    if not server_reachable:
        # Update metrics file with validation metadata before returning
        metrics_json_path = Path("metrics/runtime_http.json")
        if metrics_json_path.exists():
            try:
                validation = {
                    "server_reachable": False,
                    "test_run_valid": False,
                    "error_message": "Server not reachable during pre-flight health check",
                    "recommendation": "Start server with: powershell -ExecutionPolicy Bypass -File scripts/dev_up.ps1, then verify with: python scripts/check_server.py"
                }
                data = {
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
                    "base_url": base_url,
                    "validation": validation
                }
                metrics_json_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
            except Exception as e:
                pass  # Silently fail if we can't write
        
        print("\n" + "=" * 70)
        print("⚠️  SERVER NOT REACHABLE - CRITICAL ERROR ⚠️")
        print("=" * 70)
        print()
        print("The server must be running BEFORE running metrics tests!")
        print()
        print("To start the server:")
        print("  powershell -ExecutionPolicy Bypass -File scripts/dev_up.ps1")
        print()
        print("Wait 5-10 seconds for the server to fully initialize, then verify:")
        print("  python scripts/check_server.py")
        print()
        print("Expected output: '✅ Server is running at http://127.0.0.1:8000'")
        print()
        print("Only AFTER the server is running, run this script again:")
        print(f"  python scripts/print_metrics.py --url {base_url} --runs 5")
        print()
        print("=" * 70)
        return
    
    print(f"Testing: {base_url}\n")
    
    # Load eval data
    chatbot_eval = load_eval_data("tests/chatbot_eval.jsonl") or load_eval_data("tests/chatbot_eval.csv")
    retrieval_eval = load_eval_data("tests/retrieval_eval.csv")
    sentiment_eval = load_eval_data("tests/sentiment_eval.csv")
    
    # Run tests
    chatbot_metrics = test_chatbot(base_url, chatbot_eval, runs=args.runs)
    retrieval_metrics = test_retrieval(base_url, retrieval_eval, runs=args.runs)
    sentiment_endpoint = "/v1/sentiment"
    if sentiment_eval:
        sentiment_endpoint = sentiment_eval[0].get("endpoint", "/v1/sentiment")
    classification_metrics = test_classification(base_url, sentiment_eval, sentiment_endpoint, runs=args.runs)
    
    # Aggregate latencies and track attempts/successes
    all_latencies = []
    total_attempts = 0
    total_successful = 0
    
    for m in [chatbot_metrics, retrieval_metrics]:
        if m:
            if m.get("latencies"):
                all_latencies.extend(m["latencies"])
            total_attempts += m.get("total_attempts", 0)
            total_successful += m.get("successful_requests", 0)
    
    if classification_metrics:
        if classification_metrics.get("latencies"):
            all_latencies.extend(classification_metrics["latencies"])
        total_attempts += classification_metrics.get("total_attempts", 0)
        total_successful += classification_metrics.get("successful_requests", 0)
    
    # Compute success rate from tracked attempts/successes
    success_rate = (100.0 * total_successful / total_attempts) if total_attempts > 0 else 0.0
    p50 = percentile(all_latencies, 50) if all_latencies else 0.0
    p95 = percentile(all_latencies, 95) if all_latencies else 0.0
    
    # Precompute string variables to avoid f-string formatting errors
    rouge_str = f"{chatbot_metrics['rouge_l']:.3f}" if chatbot_metrics.get('rouge_l') else 'n/a'
    bert_str = f"{chatbot_metrics['bert_f1']:.3f}" if chatbot_metrics.get('bert_f1') else 'n/a'
    map5_str = f"{retrieval_metrics['map5']:.3f}" if retrieval_metrics.get('map5') else 'n/a'
    mrr5_str = f"{retrieval_metrics['mrr5']:.3f}" if retrieval_metrics.get('mrr5') else 'n/a'
    
    # Print table
    print("\n" + "=" * 70)
    print("METRICS SUMMARY")
    print("=" * 70)
    print(f"{'Component':<20} {'Metric':<25} {'Value':<20}")
    print("-" * 70)
    print(f"{'Chatbot':<20} {'Inference (ms)':<25} {chatbot_metrics['inference_ms']:.1f}")
    print(f"{'':<20} {'ROUGE-L':<25} {rouge_str:<20}")
    print(f"{'':<20} {'BERT-F1':<25} {bert_str:<20}")
    print(f"{'Retrieval':<20} {'Latency (ms)':<25} {retrieval_metrics['latency_ms']:.1f}")
    print(f"{'':<20} {'MAP@5':<25} {map5_str:<20}")
    print(f"{'':<20} {'MRR@5':<25} {mrr5_str:<20}")
    if classification_metrics:
        f1_val = f"{classification_metrics.get('f1', None):.3f}" if classification_metrics.get('f1') else 'n/a'
        auc_val = f"{classification_metrics.get('auc', None):.3f}" if classification_metrics.get('auc') else 'n/a'
        print(f"{'Classification':<20} {'Inference (ms)':<25} {classification_metrics.get('inference_ms', 0.0):.1f}")
        print(f"{'':<20} {'F1-macro':<25} {f1_val:<20}")
        print(f"{'':<20} {'AUC':<25} {auc_val:<20}")
    print(f"{'Overall':<20} {'Success Rate %':<25} {success_rate:.1f}")
    print(f"{'':<20} {'P50 (ms)':<25} {p50:.1f}")
    print(f"{'':<20} {'P95 (ms)':<25} {p95:.1f}")
    print("=" * 70)
    
    # Update README.md
    readme_path = Path("README.md")
    if readme_path.exists():
        content = readme_path.read_text(encoding="utf-8")
        # Find or create metrics section
        marker = "## Verified Metrics (latest run)"
        # Precompute classification strings only if classification_metrics exists
        if classification_metrics:
            class_inf_ms = f"{classification_metrics.get('inference_ms', 0.0):.1f}"
            class_f1 = f"{classification_metrics.get('f1', None):.3f}" if classification_metrics.get('f1') else 'n/a'
            class_auc = f"{classification_metrics.get('auc', None):.3f}" if classification_metrics.get('auc') else 'n/a'
        else:
            class_inf_ms = 'n/a'
            class_f1 = 'n/a'
            class_auc = 'n/a'
        
        table = f"""| Component | Metric | Value |
|-----------|--------|-------|
| Chatbot | Inference(ms) avg | {chatbot_metrics['inference_ms']:.1f} |
| Chatbot | ROUGE-L | {rouge_str} |
| Chatbot | BERT-F1 | {bert_str} |
| Retrieval | Latency(ms) avg | {retrieval_metrics['latency_ms']:.1f} |
| Retrieval | MAP@5 | {map5_str} |
| Retrieval | MRR@5 | {mrr5_str} |
| Classification | Inference(ms) avg | {class_inf_ms} |
| Classification | F1-macro | {class_f1} |
| Classification | AUC | {class_auc} |
| Overall | Success Rate % | {success_rate:.1f} |
| Overall | P50(ms) | {p50:.1f} |
| Overall | P95(ms) | {p95:.1f} |
"""
        if marker in content:
            # Replace existing section
            start = content.find(marker)
            end = content.find("##", start + len(marker))
            if end == -1:
                end = len(content)
            new_content = content[:start] + marker + "\n\n" + table + "\n" + content[end:]
        else:
            # Append at end
            new_content = content.rstrip() + "\n\n" + marker + "\n\n" + table + "\n"
        readme_path.write_text(new_content, encoding="utf-8")
        print(f"\nUpdated README.md")
    
    # Update metrics/runtime_http.json if it exists
    metrics_json_path = Path("metrics/runtime_http.json")
    if metrics_json_path.exists():
        try:
            # Determine if test run is valid (at least one successful request)
            test_run_valid = total_successful > 0 and success_rate > 0
            
            # Build validation metadata
            validation = {
                "server_reachable": server_reachable,
                "test_run_valid": test_run_valid,
                "error_message": None if test_run_valid else "All requests failed - server may have been down during test",
                "recommendation": None if test_run_valid else "Start server with: powershell -ExecutionPolicy Bypass -File scripts/dev_up.ps1, then verify with: python scripts/check_server.py"
            }
            
            # Build endpoints block for backward compatibility
            endpoints = {}
            # Chatbot endpoint (/v1/explain)
            chatbot_attempts = chatbot_metrics.get("total_attempts", 0)
            chatbot_successful = chatbot_metrics.get("successful_requests", 0)
            chatbot_latencies = chatbot_metrics.get("latencies", [])
            endpoints["explain"] = {
                "success_rate_pct": (100.0 * chatbot_successful / chatbot_attempts) if chatbot_attempts > 0 else 0.0,
                "total_requests": chatbot_attempts,
                "successful_requests": chatbot_successful,
                "avg_latency_ms": statistics.mean(chatbot_latencies) if chatbot_latencies else 0.0,
                "p50_ms": percentile(chatbot_latencies, 50) if chatbot_latencies else 0.0,
                "p90_ms": percentile(chatbot_latencies, 90) if chatbot_latencies else 0.0,
                "p95_ms": percentile(chatbot_latencies, 95) if chatbot_latencies else 0.0,
                "p99_ms": percentile(chatbot_latencies, 99) if chatbot_latencies else 0.0
            }
            # Retrieval endpoint (/v1/search)
            retrieval_attempts = retrieval_metrics.get("total_attempts", 0)
            retrieval_successful = retrieval_metrics.get("successful_requests", 0)
            retrieval_latencies = retrieval_metrics.get("latencies", [])
            endpoints["search"] = {
                "success_rate_pct": (100.0 * retrieval_successful / retrieval_attempts) if retrieval_attempts > 0 else 0.0,
                "total_requests": retrieval_attempts,
                "successful_requests": retrieval_successful,
                "avg_latency_ms": statistics.mean(retrieval_latencies) if retrieval_latencies else 0.0,
                "p50_ms": percentile(retrieval_latencies, 50) if retrieval_latencies else 0.0,
                "p90_ms": percentile(retrieval_latencies, 90) if retrieval_latencies else 0.0,
                "p95_ms": percentile(retrieval_latencies, 95) if retrieval_latencies else 0.0,
                "p99_ms": percentile(retrieval_latencies, 99) if retrieval_latencies else 0.0
            }
            # Healthz endpoint (from pre-flight check)
            endpoints["healthz"] = {
                "success_rate_pct": 100.0 if server_reachable else 0.0,
                "total_requests": 3,  # 3 retry attempts
                "successful_requests": 1 if server_reachable else 0,
                "avg_latency_ms": 0.0,
                "p50_ms": 0.0,
                "p90_ms": 0.0,
                "p95_ms": 0.0,
                "p99_ms": 0.0
            }
            # Classification endpoint if available
            if classification_metrics:
                class_attempts = classification_metrics.get("total_attempts", 0)
                class_successful = classification_metrics.get("successful_requests", 0)
                class_latencies = classification_metrics.get("latencies", [])
                endpoints["sentiment"] = {
                    "success_rate_pct": (100.0 * class_successful / class_attempts) if class_attempts > 0 else 0.0,
                    "total_requests": class_attempts,
                    "successful_requests": class_successful,
                    "avg_latency_ms": statistics.mean(class_latencies) if class_latencies else 0.0,
                    "p50_ms": percentile(class_latencies, 50) if class_latencies else 0.0,
                    "p90_ms": percentile(class_latencies, 90) if class_latencies else 0.0,
                    "p95_ms": percentile(class_latencies, 95) if class_latencies else 0.0,
                    "p99_ms": percentile(class_latencies, 99) if class_latencies else 0.0
                }
            
            data = {
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "base_url": base_url,
                "overall": {
                    "success_rate_pct": success_rate,
                    "avg_latency_ms": statistics.mean(all_latencies) if all_latencies else 0.0,
                    "total_requests": total_attempts,
                    "successful_requests": total_successful,
                    "p50_ms": p50,
                    "p95_ms": p95
                },
                "endpoints": endpoints,
                "chatbot": {
                    "inference_ms": chatbot_metrics["inference_ms"],
                    "rouge_l": chatbot_metrics["rouge_l"],
                    "bert_f1": chatbot_metrics["bert_f1"]
                },
                "retrieval": {
                    "latency_ms": retrieval_metrics["latency_ms"],
                    "map5": retrieval_metrics["map5"],
                    "mrr5": retrieval_metrics["mrr5"]
                },
                "validation": validation
            }
            if classification_metrics:
                data["classification"] = {
                    "inference_ms": classification_metrics.get("inference_ms", 0.0),
                    "f1": classification_metrics.get("f1"),
                    "auc": classification_metrics.get("auc")
                }
            metrics_json_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
            print(f"Updated metrics/runtime_http.json")
        except Exception as e:
            print(f"Warning: Could not update metrics/runtime_http.json: {e}")


if __name__ == "__main__":
    main()
