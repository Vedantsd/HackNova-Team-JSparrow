import unittest
import os
import json
import db
from app import app

class TestQuestionsAndFollowUps(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        # Log in as Aniket (Team Lead)
        login_res = self.client.post('/api/auth/login', json={
            'email': 'aniket@commitflow.dev',
            'password': 'Password@2026!'
        })
        self.assertEqual(login_res.status_code, 200, f"Login must succeed: {login_res.get_json()}")
        self.session_token = login_res.get_json()['token']

    def test_unresolved_questions_crud(self):
        # 1. Test create follow up
        created = db.create_unresolved_question(
            transcript_id=None,
            title="Test Automated Clarification Follow-up",
            category="Missing Owner",
            description="Clarify who will verify the PostgreSQL connection pooling parameters.",
            evidence="Someone needs to check pooling settings."
        )
        self.assertIsNotNone(created)
        q_id = created["id"]
        self.assertEqual(created["status"], "Pending")

        # 2. Test list unresolved questions
        questions = db.list_unresolved_questions()
        found = any(q["id"] == q_id for q in questions)
        self.assertTrue(found, "Newly created question should appear in listing")

        # 3. Test API update / resolution
        res = self.client.put(
            f"/api/unresolved-questions/{q_id}",
            headers={"Authorization": f"Bearer {self.session_token}"},
            data=json.dumps({
                "status": "Resolved",
                "resolutionNotes": "Verified by database architect; pool set to 20 connections."
            }),
            content_type="application/json"
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "Resolved")
        self.assertIsNotNone(data["resolvedBy"])
        self.assertIsNotNone(data["resolvedAt"])

        # 4. Verify resolved status query
        resolved_list = db.list_unresolved_questions(status_filter="Resolved")
        self.assertTrue(any(q["id"] == q_id for q in resolved_list))

        # 5. Verify Team Lead endpoint
        tl_res = self.client.get(
            "/api/team-lead/follow-ups",
            headers={"Authorization": f"Bearer {self.session_token}"}
        )
        self.assertEqual(tl_res.status_code, 200)
        self.assertIsInstance(tl_res.get_json(), list)

if __name__ == "__main__":
    unittest.main()
