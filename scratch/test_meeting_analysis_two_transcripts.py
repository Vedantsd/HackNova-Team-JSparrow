"""
Test script verifying Test A (transcript with confirmed decisions) and
Test B (transcript without confirmed decisions) against CommitFlow backend,
Neon PostgreSQL database, and Gemini AI analysis.
"""
import os
import sys
import json
import time

import os
import sys
import json
import time

sys.path.insert(0, r"d:\HACKNOVA\server")
sys.path.insert(0, r"d:\HACKNOVA")

import db
import ai
import app

TRANSCRIPT_A_TEXT = """[10:00] Aditi Sharma: Good morning team. Today we need to finalize the architectural approach for the caching layer and discuss our sprint goals.
[10:02] Rahul Patil: I analyzed Redis vs Memcached. Redis provides pub/sub and persistent data structures that we need for session handling. I propose we lock in Redis as our primary cache store.
[10:04] Aditi Sharma: Does everyone agree on Redis?
[10:05] Neha Kulkarni: Yes, I agree. Let's officially decide on Redis cluster with replica nodes for high availability.
[10:06] Arjun Deshmukh: Confirmed. We agree to use Redis cluster for the caching infrastructure.
[10:08] Rahul Patil: On a side note, maybe we could also explore dark mode theme for the admin portal in a future sprint? It's just a suggestion though.
[10:10] Aditi Sharma: That's a nice suggestion, but we are not approving dark mode today. Rahul, can you complete the Redis connector implementation by Friday, 30 October at 5 PM?
[10:12] Rahul Patil: Yes, I commit to delivering the Redis connector by Friday at 5 PM.
[10:15] Aditi Sharma: Great, meeting adjourned."""

TRANSCRIPT_B_TEXT = """[14:00] Priya Mehta: Welcome everyone to the retrospective brainstorm on team communication tools.
[14:02] Vikram Rao: We have been experiencing some delays in asynchronous Slack threads. What does everyone think about trying out Discord or Matrix?
[14:05] Sanya Sen: Matrix has end-to-end encryption, which is nice. But Discord has great voice channel support.
[14:08] Vikram Rao: Should we switch our team channels to Discord?
[14:10] Priya Mehta: We shouldn't make any decisions today. We need input from security and IT before agreeing to any tool change. Let's keep this as an open exploration without any decisions.
[14:12] Sanya Sen: Understood. No agreements today. We'll simply collect feedback over the next month.
[14:15] Priya Mehta: That sounds good. Meeting closed."""

def run_tests():
    print("=" * 70)
    print("TESTING COMMITFLOW MEETING ANALYSIS — TEST A & TEST B")
    print("=" * 70)

    # Initialize DB schema
    db.init_schema()

    tx_a_id = f"tx-test-a-{int(time.time())}"
    tx_b_id = f"tx-test-b-{int(time.time())}"

    # Retrieve an active user from DB to satisfy FK constraint
    test_user_id = None
    if db.get_connection_url():
        with db.get_db_cursor(commit=False) as cur:
            cur.execute("SELECT id FROM users WHERE status = 'active' LIMIT 1;")
            u_row = cur.fetchone()
            if u_row:
                test_user_id = u_row["id"]

    # -------------------------------------------------------------
    # 1. TEST A: Transcript with confirmed decisions
    # -------------------------------------------------------------
    print(f"\n--- [1] Ingesting Transcript A (ID: {tx_a_id}) ---")
    tx_a_record = {
        "id": tx_a_id,
        "title": "Sprint Architecture & Caching Strategy",
        "filename": "caching_strategy_meeting.txt",
        "fileSize": f"{len(TRANSCRIPT_A_TEXT)/1024:.1f} KB",
        "fileType": "TXT",
        "sourceType": "Uploaded Transcript",
        "uploadedAt": "Oct 24, 2026, 10:00 AM",
        "status": "Processing",
        "duration": "15 min",
        "participants": ["Aditi Sharma", "Rahul Patil", "Neha Kulkarni", "Arjun Deshmukh"],
        "text": TRANSCRIPT_A_TEXT,
        "transcriptText": TRANSCRIPT_A_TEXT,
        "userId": test_user_id
    }

    if db.get_connection_url():
        db.insert_transcript(tx_a_record, user_id=test_user_id)
    else:
        app._mem_store["transcripts"][tx_a_id] = tx_a_record

    print("Analyzing Transcript A with Gemini AI...")
    app.process_transcript_async(tx_a_id, TRANSCRIPT_A_TEXT, title="Sprint Architecture & Caching Strategy", meeting_date="2026-10-24")

    # Load from DB/Backend
    if db.get_connection_url():
        res_a = db.get_transcript_by_id(tx_a_id, user_id=test_user_id, is_admin=True)
    else:
        res_a = app._mem_store["transcripts"][tx_a_id]

    assert res_a is not None, "Transcript A not found in backend"
    assert res_a.get("status") == "Processed", f"Expected Processed, got {res_a.get('status')}"
    print(f"Status for A: {res_a.get('status')}")

    # Verify Summary
    summary_a = res_a.get("summary")
    assert summary_a is not None, "Summary A must not be None"
    assert "redis" in summary_a.get("overview", "").lower() or "caching" in summary_a.get("overview", "").lower(), \
        f"Summary A should mention caching or Redis: {summary_a.get('overview')}"
    print("PASS: Transcript A summary reflects caching/Redis discussion.")

    # Verify Decisions
    decisions_a = res_a.get("decisions", [])
    print(f"Decisions extracted for A: {len(decisions_a)}")
    for d in decisions_a:
        print(f"  - Decision: {d.get('title')}")
        print(f"    Details: {d.get('details')}")
        ev = d.get("evidence") or {}
        print(f"    Evidence: Speaker={ev.get('speaker')}, Timestamp={ev.get('timestamp')}, Quote={ev.get('quote')}")

    assert len(decisions_a) >= 1, "Transcript A must have at least one confirmed decision"
    # Check that decision is about Redis/caching
    found_redis_decision = any("redis" in d.get("title", "").lower() or "cache" in d.get("title", "").lower() or "redis" in d.get("details", "").lower() for d in decisions_a)
    assert found_redis_decision, "Confirmed decision for Redis cluster must appear in decisions"
    print("PASS: Confirmed decision for Redis appears in Decisions & Agreements.")

    # Check that suggestion (dark mode) is NOT in decisions
    dark_mode_in_decisions = any("dark mode" in d.get("title", "").lower() or "dark mode" in d.get("details", "").lower() for d in decisions_a)
    assert not dark_mode_in_decisions, "Suggestion for 'dark mode' must NOT be classified as a confirmed decision"
    print("PASS: The suggestion ('dark mode') was correctly NOT treated as a confirmed decision.")

    # Verify Transcript Evidence
    assert res_a.get("transcriptText") == TRANSCRIPT_A_TEXT, "Transcript text must match source verbatim"
    print("PASS: Transcript Evidence shows original source text verbatim.")

    # -------------------------------------------------------------
    # 2. TEST B: Transcript WITHOUT confirmed decisions
    # -------------------------------------------------------------
    print(f"\n--- [2] Ingesting Transcript B (ID: {tx_b_id}) ---")
    tx_b_record = {
        "id": tx_b_id,
        "title": "Team Communication Tool Exploration",
        "filename": "comm_tools_brainstorm.txt",
        "fileSize": f"{len(TRANSCRIPT_B_TEXT)/1024:.1f} KB",
        "fileType": "TXT",
        "sourceType": "Uploaded Transcript",
        "uploadedAt": "Oct 24, 2026, 02:00 PM",
        "status": "Processing",
        "duration": "15 min",
        "participants": ["Priya Mehta", "Vikram Rao", "Sanya Sen"],
        "text": TRANSCRIPT_B_TEXT,
        "transcriptText": TRANSCRIPT_B_TEXT,
        "userId": test_user_id
    }

    if db.get_connection_url():
        db.insert_transcript(tx_b_record, user_id=test_user_id)
    else:
        app._mem_store["transcripts"][tx_b_id] = tx_b_record

    print("Analyzing Transcript B with Gemini AI...")
    app.process_transcript_async(tx_b_id, TRANSCRIPT_B_TEXT, title="Team Communication Tool Exploration", meeting_date="2026-10-24")

    # Load from DB/Backend
    if db.get_connection_url():
        res_b = db.get_transcript_by_id(tx_b_id, user_id=test_user_id, is_admin=True)
    else:
        res_b = app._mem_store["transcripts"][tx_b_id]

    assert res_b is not None, "Transcript B not found in backend"
    assert res_b.get("status") == "Processed", f"Expected Processed, got {res_b.get('status')}"
    print(f"Status for B: {res_b.get('status')}")

    # Verify Summary for B reflects second transcript
    summary_b = res_b.get("summary")
    assert summary_b is not None, "Summary B must not be None"
    b_overview = summary_b.get("overview", "").lower()
    assert any(term in b_overview for term in ["communication", "discord", "matrix", "slack", "tools", "brainstorm", "retrospective"]), \
        f"Summary B should mention communication tools: {summary_b.get('overview')}"
    print("PASS: Transcript B summary reflects communication tools exploration.")

    # Verify Decisions for B has 0 confirmed decisions
    decisions_b = res_b.get("decisions", [])
    print(f"Decisions extracted for B: {len(decisions_b)}")
    assert len(decisions_b) == 0, f"Transcript B has no confirmed decisions, but got: {decisions_b}"
    print("PASS: Decisions & Agreements has 0 decisions (honest empty state) for Transcript B.")

    # Verify Evidence comes from second transcript
    assert res_b.get("transcriptText") == TRANSCRIPT_B_TEXT, "Evidence must come from second transcript"
    assert "Priya Mehta" in res_b.get("transcriptText"), "Priya Mehta must be in Transcript B text"
    print("PASS: Evidence comes from Transcript B, not Transcript A.")

    # -------------------------------------------------------------
    # 3. Data Isolation Check: Zero leakage between transcripts
    # -------------------------------------------------------------
    print("\n--- [3] Data Isolation Check Between Transcripts ---")
    assert "Redis" not in json.dumps(res_b.get("summary")), "Transcript A's Redis content leaked into Transcript B summary!"
    assert "Redis" not in json.dumps(res_b.get("decisions")), "Transcript A's Redis decision leaked into Transcript B decisions!"
    assert "Aditi Sharma" not in res_b.get("transcriptText"), "Transcript A participant leaked into Transcript B!"
    print("PASS: 100% Data isolation verified — zero leakage from Transcript A into Transcript B.")

    # -------------------------------------------------------------
    # 4. Persistence Reload Check
    # -------------------------------------------------------------
    print("\n--- [4] Persistence Reload Verification ---")
    reloaded_a = db.get_transcript_by_id(tx_a_id, user_id=test_user_id, is_admin=True) if db.get_connection_url() else app._mem_store["transcripts"][tx_a_id]
    reloaded_b = db.get_transcript_by_id(tx_b_id, user_id=test_user_id, is_admin=True) if db.get_connection_url() else app._mem_store["transcripts"][tx_b_id]

    assert reloaded_a["summary"]["overview"] == res_a["summary"]["overview"]
    assert len(reloaded_a["decisions"]) == len(decisions_a)
    assert len(reloaded_b["decisions"]) == 0
    print("PASS: Database persistence reloads identical structured analysis after page refresh simulation.")

    print("\n" + "=" * 70)
    print("ALL TESTS (TEST A, TEST B, ISOLATION, PERSISTENCE) PASSED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
