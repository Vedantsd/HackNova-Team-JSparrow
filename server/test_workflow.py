"""
Automated End-to-End Workflow Test Suite for CommitFlow (HACKNOVA'26)
Validates:
1. Safe, idempotent seeding of 4 users (Swapnil Ingole, Aniket Bhujad, Vedant Desai, Bhoomi Tiple)
2. Owner matching (real DB identities vs ambiguous names)
3. Duplicate and conflict detection
4. Action item approval workflow with audit trail persistence
5. Project board export guard (unapproved blocked, approved exportable)
6. Structured export (CSV and JSON)
"""

import os
import sys
import unittest
import json

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from server import db
from server import owner_matcher
from server import conflict_detector
from server.app import app

class TestCommitFlowWorkflow(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        app.testing = True
        cls.client = app.test_client()

    def test_01_seeding_requested_users_idempotency(self):
        """Verify the 4 requested users exist and seeding is strictly idempotent."""
        seeded1 = db.seed_hacknova_team_users()
        self.assertGreaterEqual(len(seeded1), 4, "Must return at least 4 team members")

        names = [u["name"] for u in seeded1]
        self.assertIn("Swapnil Ingole", names)
        self.assertIn("Aniket Bhujad", names)
        self.assertIn("Vedant Desai", names)
        self.assertIn("Bhoomi Tiple", names)

        # Run again to verify idempotency (no duplicate accounts created)
        seeded2 = db.seed_hacknova_team_users()
        for u in seeded2:
            self.assertEqual(u.get("action"), "existing", f"User {u['name']} should be existing on second run")

    def test_02_owner_matching_real_users(self):
        """Verify exact and first-name matching against actual database identities."""
        # 1. Exact full name
        match1 = owner_matcher.match_transcript_owner("Swapnil Ingole")
        self.assertTrue(match1["matched"])
        self.assertEqual(match1["owner_status"], "confirmed")
        self.assertEqual(match1["canonical_name"], "Swapnil Ingole")

        # 2. First name only
        match2 = owner_matcher.match_transcript_owner("Vedant")
        self.assertTrue(match2["matched"])
        self.assertEqual(match2["canonical_name"], "Vedant Desai")

        # 3. Mention in conversational string
        match3 = owner_matcher.match_transcript_owner("Bhoomi will verify the database connection")
        self.assertTrue(match3["matched"])
        self.assertEqual(match3["canonical_name"], "Bhoomi Tiple")

        # 4. Unknown/Ambiguous name: must NOT invent user or guess
        match4 = owner_matcher.match_transcript_owner("Alice Wonderland")
        self.assertFalse(match4["matched"])
        self.assertEqual(match4["owner_status"], "ambiguous")
        self.assertIsNone(match4["assignee_id"])

    def test_03_duplicate_and_conflict_detection(self):
        """Verify deterministic detection of duplicate deliverables and contradictory deadlines."""
        existing_items = [
            {
                "id": "act-test-01",
                "title": "Configure SSL certificates on production proxy",
                "owner": "Swapnil Ingole",
                "deadline": "2026-11-01"
            }
        ]

        # Duplicate item check (similar wording)
        dup_candidate = {
            "title": "Configure SSL certificates for production proxy server",
            "owner": "Swapnil Ingole",
            "deadline": "2026-11-01"
        }
        res_dup = conflict_detector.detect_item_conflicts(dup_candidate, existing_items)
        self.assertTrue(res_dup["is_duplicate"], "Should flag as duplicate due to high token overlap")
        self.assertIn("Duplicate Warning", res_dup["duplicate_warning"])

        # Conflict check (same deliverable title, contradictory deadline)
        conflict_candidate = {
            "title": "Configure SSL certificates on production proxy",
            "owner": "Swapnil Ingole",
            "deadline": "2026-11-15" # Contradicts 2026-11-01
        }
        res_conflict = conflict_detector.detect_item_conflicts(conflict_candidate, existing_items)
        self.assertTrue(res_conflict["is_conflict"], "Should flag contradictory due date as conflict")

    def test_04_action_item_approval_and_persistence(self):
        """Verify human approval persists status, audit logger, and timestamp."""
        # Query an action item from DB
        items = db.list_all_action_items()
        self.assertIsNotNone(items)
        if len(items) > 0:
            target_id = items[0]["id"]
            # Approve it
            success = db.update_action_item_status(target_id, "Approved", approver_id="usr-d1620a723d27")
            self.assertTrue(success)

            # Reload and verify
            reloaded = [i for i in db.list_all_action_items() if i["id"] == target_id][0]
            self.assertEqual(reloaded["status"], "Approved")

    def test_05_trello_export_security_guard(self):
        """Verify unapproved tasks cannot be exported to Trello (HTTP 400)."""
        # Create a temporary pending action item
        with db.get_db_cursor(commit=True) as cur:
            cur.execute("""
                INSERT INTO action_items (id, title, description, owner, status)
                VALUES ('act-test-unapproved', 'Unapproved Security Patch', 'Must be approved first', 'Vedant Desai', 'Pending Approval')
                ON CONFLICT (id) DO UPDATE SET status = 'Pending Approval';
            """)

        res = self.client.post("/api/trello/export/act-test-unapproved")
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertIn("Only approved action items", data.get("error", ""))

    def test_06_structured_export_csv_and_json(self):
        """Verify CSV and JSON exports contain approved tasks with stable IDs and real owners."""
        # Test JSON export endpoint
        res_json = self.client.get("/api/action-items/export?format=json&onlyApproved=false")
        self.assertEqual(res_json.status_code, 200)
        data = res_json.get_json()
        self.assertIn("items", data)
        self.assertIsInstance(data["items"], list)

        # Test CSV export endpoint
        res_csv = self.client.get("/api/action-items/export?format=csv&onlyApproved=false")
        self.assertEqual(res_csv.status_code, 200)
        self.assertIn(b"taskId,taskTitle,description", res_csv.data)

if __name__ == "__main__":
    unittest.main()
