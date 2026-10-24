"""
PS-4 Comprehensive Regression Test Suite for CommitFlow
Validates:
1. Demo Transcript Extraction & Classification (Commitment vs Suggestion, Relative Dates, Evidence)
2. Owner Matching (Real identities, Confirmed vs Ambiguous, No Silent Invention)
3. Duplicate and Conflict Detection (Token overlap, Contradictory deadlines, Risk vs Confirmed Conflict)
4. Human Approval Workflow & Persistence (Pending -> Approved / Rejected, Audit Trail, Idempotency)
5. Authorization & Data Isolation (Anonymous blocked, Cross-user isolation, RBAC enforcement)
6. Error Handling & Failure Safeguards (No fabricated data on failure, Trello unapproved guard)
7. End-to-End Database Persistence (Neon PostgreSQL relational integrity across reloads)
"""

import os
import sys
import unittest
import json
from unittest.mock import patch

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from server import db
from server import owner_matcher
from server import conflict_detector
from server import ai
from server.app import app
from server.fixtures.demo_transcript import DEMO_TRANSCRIPT_TEXT, EXPECTED_EVIDENCE


class TestPS4ComprehensiveRegression(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        app.testing = True
        db.init_schema()
        db.seed_hacknova_team_users()
        db.seed_demo_sprint_users()

        # Helper client for authentication
        auth_client = app.test_client()

        # Admin
        admin_login = auth_client.post('/api/auth/login', json={
            'email': 'admin@commitflow.dev',
            'password': 'Admin@CommitFlow2026!'
        })
        cls.admin_token = admin_login.get_json().get('token')

        # Team Lead (Aditi Sharma)
        aditi_login = auth_client.post('/api/auth/login', json={
            'email': 'aditi@commitflow.dev',
            'password': 'Sprint@2026!'
        })
        cls.lead_token = aditi_login.get_json().get('token')

        # Regular User (Rahul Patil)
        rahul_login = auth_client.post('/api/auth/login', json={
            'email': 'rahul@commitflow.dev',
            'password': 'Sprint@2026!'
        })
        cls.user_token = rahul_login.get_json().get('token')

        # Second Regular User (Arjun Deshmukh)
        arjun_login = auth_client.post('/api/auth/login', json={
            'email': 'arjun@commitflow.dev',
            'password': 'Sprint@2026!'
        })
        cls.other_user_token = arjun_login.get_json().get('token')

    def get_client(self, token=None):
        """Create a fresh test client optionally configured with Bearer auth."""
        client = app.test_client()
        if token:
            client.environ_base['HTTP_AUTHORIZATION'] = f"Bearer {token}"
        return client

    # =========================================================================
    # 1. OWNER MATCHING AUDIT & TESTS
    # =========================================================================
    def test_01_owner_matching_real_team_members(self):
        """Verify participants are matched to registered users with high confidence."""
        # Rahul Patil
        m_rahul = owner_matcher.match_transcript_owner("Rahul")
        self.assertTrue(m_rahul["matched"])
        self.assertEqual(m_rahul["owner_status"], "confirmed")
        self.assertEqual(m_rahul["canonical_name"], "Rahul Patil")
        self.assertIsNotNone(m_rahul["assignee_id"])

        # Neha Kulkarni
        m_neha = owner_matcher.match_transcript_owner("Neha Kulkarni")
        self.assertTrue(m_neha["matched"])
        self.assertEqual(m_neha["owner_status"], "confirmed")
        self.assertEqual(m_neha["canonical_name"], "Neha Kulkarni")

        # Arjun Deshmukh
        m_arjun = owner_matcher.match_transcript_owner("Arjun")
        self.assertTrue(m_arjun["matched"])
        self.assertEqual(m_arjun["canonical_name"], "Arjun Deshmukh")

        # Aditi Sharma
        m_aditi = owner_matcher.match_transcript_owner("Aditi Sharma")
        self.assertTrue(m_aditi["matched"])
        self.assertEqual(m_aditi["canonical_name"], "Aditi Sharma")

    def test_02_owner_matching_unassigned_and_unknown(self):
        """Verify unassigned and unknown persons remain ambiguous without silent assignment."""
        # Unassigned
        m_unassigned = owner_matcher.match_transcript_owner("Unassigned")
        self.assertFalse(m_unassigned["matched"])
        self.assertEqual(m_unassigned["owner_status"], "ambiguous")
        self.assertIsNone(m_unassigned["assignee_id"])

        # Unknown person not in DB
        m_unknown = owner_matcher.match_transcript_owner("Christopher Nolan")
        self.assertFalse(m_unknown["matched"])
        self.assertEqual(m_unknown["owner_status"], "ambiguous")
        self.assertIsNone(m_unknown["assignee_id"])

    # =========================================================================
    # 2. DUPLICATE AND CONFLICT DETECTION TESTS
    # =========================================================================
    def test_03_duplicate_detection(self):
        """Verify duplicate tasks are detected via title overlap without destroying original."""
        existing = [
            {"id": "act-reg-01", "title": "Complete authentication API and token validation", "owner": "Rahul Patil", "deadline": "2026-10-22"}
        ]
        candidate = {
            "title": "Complete authentication API and token validation tests",
            "owner": "Rahul Patil",
            "deadline": "2026-10-22"
        }
        res = conflict_detector.detect_item_conflicts(candidate, existing)
        self.assertTrue(res["is_duplicate"])
        self.assertIn("Duplicate Warning", res["duplicate_warning"])

    def test_04_conflict_detection_contradictory_deadline(self):
        """Verify contradictory deadlines for the same task are flagged as conflicts."""
        existing = [
            {"id": "act-reg-02", "title": "Dashboard integration with backend APIs", "owner": "Neha Kulkarni", "deadline": "2026-10-23"}
        ]
        candidate = {
            "title": "Dashboard integration with backend APIs",
            "owner": "Neha Kulkarni",
            "deadline": "2026-10-30"  # Contradicts 2026-10-23
        }
        res = conflict_detector.detect_item_conflicts(candidate, existing)
        self.assertTrue(res["is_conflict"])
        self.assertIn("Contradictory deadlines", res["conflict_warning"])

    def test_05_dependency_risk_not_false_task_conflict(self):
        """Verify that distinct deliverables (e.g. API build vs API contract handoff) are not false duplicates."""
        existing = [
            {"id": "act-reg-03", "title": "Complete authentication API and tests", "owner": "Rahul Patil", "deadline": "2026-10-22 17:00"}
        ]
        candidate = {
            "title": "Share API response format and contract with Neha",
            "owner": "Rahul Patil",
            "deadline": "2026-10-21 14:00"
        }
        res = conflict_detector.detect_item_conflicts(candidate, existing)
        self.assertFalse(res["is_duplicate"], "API contract handoff must not be flagged as duplicate of API completion")
        self.assertFalse(res["is_conflict"], "Different milestones should not be flagged as contradictory conflict")

    # =========================================================================
    # 3. AI EXTRACTION & SCHEMA VALIDATION TESTS
    # =========================================================================
    def test_06_demo_transcript_ai_extraction(self):
        """Verify AI extraction matches PS-4 rules: commitments vs suggestions, relative dates, no hallucinations."""
        analysis = ai.analyze_transcript(DEMO_TRANSCRIPT_TEXT, meeting_date="2026-10-20")

        self.assertIsNotNone(analysis)
        overview = analysis.get("summary", {}).get("overview", "")
        self.assertTrue(len(overview) > 0, "Summary overview must be present")

        # Check commitments vs suggestions
        items = analysis.get("actionItems", [])
        self.assertGreaterEqual(len(items), 4, "Must extract at least 4 items")

        commitments = [it for it in items if it.get("itemType") == "commitment"]
        suggestions = [it for it in items if it.get("itemType") == "suggestion"]

        self.assertGreaterEqual(len(commitments), 3, "Must extract explicit commitments")
        self.assertGreaterEqual(len(suggestions), 1, "Must extract suggestions (dark mode / notification panel)")

        # Verify Rahul API task
        rahul_items = [it for it in commitments if "Rahul" in it.get("owner", "") or "API" in it.get("title", "")]
        self.assertTrue(len(rahul_items) >= 1, "Must find Rahul's API task")
        api_task = rahul_items[0]
        self.assertIn("2026-10-22", api_task.get("deadline", ""), f"Relative date 'Thursday 22 October' must resolve to 2026-10-22, got: {api_task.get('deadline')}")

        # Verify Neha Dashboard task
        neha_items = [it for it in commitments if "Neha" in it.get("owner", "") or "Dashboard" in it.get("title", "")]
        self.assertTrue(len(neha_items) >= 1, "Must find Neha's dashboard task")
        dash_task = neha_items[0]
        self.assertIn("2026-10-23", dash_task.get("deadline", ""), f"Relative date 'Friday 23 October' must resolve to 2026-10-23, got: {dash_task.get('deadline')}")

        # Verify Dark Mode is classified as suggestion and has no invented deadline/owner
        dark_mode_items = [it for it in items if "Dark Mode" in it.get("title", "") or "dark mode" in it.get("title", "").lower()]
        if dark_mode_items:
            dm = dark_mode_items[0]
            self.assertEqual(dm.get("itemType"), "suggestion", "Dark mode must be classified as suggestion, not approved task")
            dm_owner = dm.get("owner", "")
            self.assertTrue(
                dm_owner == "Unassigned" or dm_owner == "" or "unassigned" in dm_owner.lower() or "no one" in dm_owner.lower(),
                f"Dark mode owner must remain unassigned, got: {dm_owner}"
            )

        # Verify Unresolved Questions include dark mode or dependency risk
        questions = analysis.get("unresolvedQuestions", [])
        self.assertGreaterEqual(len(questions), 1, "Must capture unresolved questions or risks")
        q_titles = " ".join([q.get("title", "") + " " + q.get("description", "") for q in questions]).lower()
        self.assertTrue("dark mode" in q_titles or "notification" in q_titles or "dependency" in q_titles or "format" in q_titles)

    # =========================================================================
    # 4. DATABASE RELATIONAL PERSISTENCE TESTS
    # =========================================================================
    def test_07_end_to_end_db_persistence(self):
        """Save a complete transcript with decisions, action items, and follow-ups, then reload and verify fields."""
        tx_id = "tx-test-persistence-001"
        analysis_data = {
            "summary": {
                "overview": "Persistence regression test summary.",
                "keyDiscussionPoints": ["DB is persistent", "Auth is verified"],
                "outcomes": "System ready"
            },
            "duration": "25 min",
            "topics": ["Architecture", "Testing"],
            "keyPoints": ["DB is persistent", "Auth is verified"],
            "decisions": [
                {
                    "title": "Adopt PostgreSQL",
                    "details": "Neon cloud",
                    "evidence": {"speaker": "Rahul Patil", "timestamp": "00:00", "quote": "Use Neon DB"}
                }
            ],
            "actionItems": [
                {
                    "title": "Build user auth service",
                    "description": "Auth endpoints",
                    "owner": "Rahul Patil",
                    "ownerStatus": "confirmed",
                    "deadline": "2026-10-22 17:00",
                    "deadlineStatus": "confirmed",
                    "priority": "High",
                    "itemType": "commitment",
                    "status": "Pending Approval",
                    "confidenceScore": 0.95,
                    "evidence": {"speaker": "Rahul Patil", "timestamp": "01:00", "quote": "I will build auth."}
                },
                {
                    "title": "Evaluate dark mode UI",
                    "description": "Exploration",
                    "owner": "Unassigned",
                    "ownerStatus": "ambiguous",
                    "deadline": "Unspecified",
                    "deadlineStatus": "missing",
                    "priority": "Low",
                    "itemType": "suggestion",
                    "status": "Pending Approval",
                    "confidenceScore": 0.85,
                    "evidence": {"speaker": "Aditi Sharma", "timestamp": "02:00", "quote": "Consider dark mode"}
                }
            ],
            "unresolvedQuestions": [
                {
                    "title": "API response format freeze date",
                    "description": "When will response format be finalized?",
                    "category": "Dependency",
                    "evidence": "Rahul and Neha need to coordinate format"
                }
            ]
        }

        # Create base transcript
        db.create_transcript(
            transcript_id=tx_id,
            title="Persistence Test Meeting",
            source="text",
            status="Processing",
            raw_text="Aditi: Rahul build auth. Rahul: Ok.",
            user_id="usr-d99c17fdb184",
            meeting_date="2026-10-20"
        )

        # Save analysis
        saved = db.save_analysis_results(tx_id, analysis_data)
        self.assertTrue(saved)

        # Reload
        reloaded = db.get_transcript_by_id(tx_id, user_id="usr-d99c17fdb184")
        self.assertIsNotNone(reloaded)
        self.assertEqual(reloaded["status"], "Processed")
        self.assertEqual(len(reloaded["decisions"]), 1)
        self.assertEqual(len(reloaded["actionItems"]), 2)
        self.assertEqual(len(reloaded["unresolvedQuestions"]), 1)

        # Check action item fields preserved
        act_items = reloaded["actionItems"]
        commitment_item = next((i for i in act_items if i["title"] == "Build user auth service"), None)
        self.assertIsNotNone(commitment_item)
        self.assertEqual(commitment_item["itemType"], "commitment")
        self.assertEqual(commitment_item["owner"], "Rahul Patil")
        self.assertEqual(commitment_item["ownerStatus"], "confirmed")
        self.assertIsNotNone(commitment_item["assigneeId"])

        suggestion_item = next((i for i in act_items if i["title"] == "Evaluate dark mode UI"), None)
        self.assertIsNotNone(suggestion_item)
        self.assertEqual(suggestion_item["itemType"], "suggestion")
        self.assertEqual(suggestion_item["ownerStatus"], "ambiguous")
        self.assertIsNone(suggestion_item["assigneeId"])

    # =========================================================================
    # 5. HUMAN APPROVAL WORKFLOW & AUDIT TRAIL TESTS
    # =========================================================================
    def test_08_approval_rejection_workflow(self):
        """Verify action items can be edited, approved, rejected with audit fields and idempotent operations."""
        # Insert a pending item
        item_id = "act-audit-test-01"
        with db.get_db_cursor(commit=True) as cur:
            cur.execute("""
                INSERT INTO action_items (id, title, description, owner, status)
                VALUES (%s, 'Database Indexing', 'Add btree indexes', 'Rahul Patil', 'Pending Approval')
                ON CONFLICT (id) DO UPDATE SET status = 'Pending Approval';
            """, (item_id,))

        client = self.get_client(self.lead_token)

        # 1. Edit item
        edit_res = client.put(f"/api/action-items/{item_id}", json={
            "title": "Optimized Database Indexing",
            "owner": "Rahul Patil",
            "deadline": "2026-10-25 18:00"
        })
        self.assertEqual(edit_res.status_code, 200)

        # 2. Approve item
        app_res = client.post(f"/api/action-items/{item_id}/approve")
        self.assertEqual(app_res.status_code, 200)
        data = app_res.get_json()
        self.assertEqual(data["status"], "Approved")
        self.assertIsNotNone(data.get("approvedBy"))

        # 3. Repeat approval (idempotent)
        repeat_res = client.post(f"/api/action-items/{item_id}/approve")
        self.assertEqual(repeat_res.status_code, 200)
        self.assertEqual(repeat_res.get_json()["status"], "Approved")

        # 4. Reject item
        rej_res = client.post(f"/api/action-items/{item_id}/reject")
        self.assertEqual(rej_res.status_code, 200)
        self.assertEqual(rej_res.get_json()["status"], "Rejected")

    # =========================================================================
    # 6. AUTHORIZATION & DATA ISOLATION TESTS
    # =========================================================================
    def test_09_anonymous_cannot_access_private_transcripts(self):
        """Verify unauthenticated user receives 401 when attempting to view a private transcript."""
        # Create private transcript for Rahul
        priv_id = "tx-private-rahul-01"
        db.create_transcript(
            transcript_id=priv_id,
            title="Confidential Backend Roadmap",
            source="text",
            status="Processed",
            raw_text="Confidential text",
            user_id="usr-d99c17fdb184"
        )

        anon_client = self.get_client()
        anon_res = anon_client.get(f"/api/transcripts/{priv_id}")
        self.assertEqual(anon_res.status_code, 401, "Anonymous user must be rejected with 401 Unauthorized")

    def test_10_cross_user_transcript_isolation(self):
        """Verify User B cannot access User A's private transcript (403 Forbidden)."""
        priv_id = "tx-private-rahul-02"
        db.create_transcript(
            transcript_id=priv_id,
            title="Rahul's Private 1-on-1",
            source="text",
            status="Processed",
            raw_text="Private text",
            user_id="usr-d99c17fdb184" # Rahul
        )

        # Arjun (other_user_token) tries to access Rahul's transcript
        arjun_client = self.get_client(self.other_user_token)
        arjun_res = arjun_client.get(f"/api/transcripts/{priv_id}")
        self.assertEqual(arjun_res.status_code, 403, "Cross-user access must be blocked with 403 Forbidden")

    def test_11_unauthenticated_cannot_approve_action_items(self):
        """Verify unauthenticated request to approve an action item is rejected with 401."""
        anon_client = self.get_client()
        res = anon_client.post("/api/action-items/act-audit-test-01/approve")
        self.assertEqual(res.status_code, 401, "Must require authentication to approve")

    # =========================================================================
    # 7. FAILURE SAFEGUARDS & TRELLO GUARDS
    # =========================================================================
    def test_12_gemini_failure_produces_failed_status_without_fabrication(self):
        """Verify that when AI service fails, status becomes 'Failed' and no fake tasks are created."""
        fail_tx_id = "tx-fail-sim-001"
        db.create_transcript(
            transcript_id=fail_tx_id,
            title="Simulated Failure Meeting",
            source="text",
            status="Processing",
            raw_text="Aditi: This will fail.",
            user_id="usr-d99c17fdb184"
        )

        import server.app
        with patch.object(server.app.ai, "analyze_transcript", side_effect=RuntimeError("Simulated Gemini API 503 rate limit")):
            server.app.process_transcript_async(fail_tx_id, "Aditi: This will fail.", meeting_date="2026-10-20")

        # Verify DB status is 'Failed' with error message
        reloaded = db.get_transcript_by_id(fail_tx_id, user_id="usr-d99c17fdb184")
        self.assertEqual(reloaded["status"], "Failed")
        self.assertIn("Simulated Gemini API 503", reloaded.get("errorMessage", ""))
        self.assertEqual(len(reloaded.get("actionItems", [])), 0, "Failed analysis must not fabricate action items")
        self.assertEqual(len(reloaded.get("decisions", [])), 0, "Failed analysis must not fabricate decisions")

    def test_13_trello_unapproved_task_guard(self):
        """Verify unapproved tasks cannot be exported to Trello."""
        unapp_id = "act-guard-unapproved-01"
        with db.get_db_cursor(commit=True) as cur:
            cur.execute("""
                INSERT INTO action_items (id, title, description, owner, status)
                VALUES (%s, 'Secret Unapproved Fix', 'Desc', 'Rahul Patil', 'Pending Approval')
                ON CONFLICT (id) DO UPDATE SET status = 'Pending Approval';
            """, (unapp_id,))

        client = self.get_client(self.lead_token)
        res = client.post(f"/api/trello/export/{unapp_id}")
        self.assertEqual(res.status_code, 400)
        self.assertIn("Only approved", res.get_json().get("error", ""))


if __name__ == "__main__":
    unittest.main()
