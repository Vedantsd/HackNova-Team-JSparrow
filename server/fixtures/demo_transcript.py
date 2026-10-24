"""
CommitFlow Sprint Planning and Execution Review — Demo Transcript Fixture
Date: 20 October 2026
Participants:
- Aditi Sharma (Team Lead)
- Rahul Patil (Backend Developer)
- Neha Kulkarni (Frontend Developer)
- Arjun Deshmukh (QA Engineer)

This fixture represents the ground-truth test data for PS-4 Meeting-to-Execution Automation.
"""

DEMO_MEETING_TITLE = "CommitFlow Sprint Planning and Execution Review"
DEMO_MEETING_DATE = "2026-10-20"
DEMO_MEETING_DATE_STR = "20 October 2026"

DEMO_PARTICIPANTS = [
    {"name": "Aditi Sharma", "role": "Team Lead", "email": "aditi@commitflow.dev"},
    {"name": "Rahul Patil", "role": "Backend Developer", "email": "rahul@commitflow.dev"},
    {"name": "Neha Kulkarni", "role": "Frontend Developer", "email": "neha@commitflow.dev"},
    {"name": "Arjun Deshmukh", "role": "QA Engineer", "email": "arjun@commitflow.dev"},
]

DEMO_TRANSCRIPT_TEXT = """Meeting: CommitFlow Sprint Planning and Execution Review
Date: 20 October 2026
Participants: Aditi Sharma (Team Lead), Rahul Patil (Backend Developer), Neha Kulkarni (Frontend Developer), Arjun Deshmukh (QA Engineer)

Transcript:

Aditi: We need to finish the authentication API and the dashboard before Friday, 23 October. Rahul, please complete the authentication API and add tests for login and token validation by Thursday, 22 October, at 5 PM.

Rahul: I can complete the API by Thursday at 5 PM. I will also add tests for login and token validation.

Aditi: Neha, please complete the dashboard integration by Friday, 23 October, at 3 PM. Make sure it uses the real backend APIs rather than local demo data.

Neha: I will complete the integration by Friday at 3 PM. I may need Rahul's API response format before I can finish.

Rahul: I will share the API response format with Neha by Wednesday, 21 October, at 2 PM.

Aditi: Arjun, please prepare regression tests for login and dashboard integration by Friday, 23 October, at 5 PM.

Arjun: I will prepare the regression tests by Friday at 5 PM. I need the final dashboard build before I can finish the integration tests.

Aditi: We should also consider adding dark mode in a future sprint. No one is assigned to that yet, and we have not agreed on a deadline.

Neha: I suggest adding a notification panel too, but we have not decided whether it belongs in this sprint.

Rahul: There may be a dependency conflict if the dashboard API response format changes after I share it. We should confirm the response contract before integration testing.

Aditi: Agreed. Rahul will share the API response contract on Wednesday, and Neha and Arjun will confirm that it meets their integration requirements. We will review any unresolved compatibility issues before the regression test run."""

EXPECTED_EVIDENCE = {
    "commitments": [
        {
            "deliverable": "Authentication API and tests for login and token validation",
            "owner": "Rahul Patil",
            "deadline_date": "2026-10-22",
            "deadline_time": "17:00",
            "item_type": "commitment",
            "status": "Pending Approval",
        },
        {
            "deliverable": "Dashboard integration using real backend APIs",
            "owner": "Neha Kulkarni",
            "deadline_date": "2026-10-23",
            "deadline_time": "15:00",
            "item_type": "commitment",
            "status": "Pending Approval",
        },
        {
            "deliverable": "Share API response format / contract",
            "owner": "Rahul Patil",
            "deadline_date": "2026-10-21",
            "deadline_time": "14:00",
            "item_type": "commitment",
            "status": "Pending Approval",
        },
        {
            "deliverable": "Regression tests for login and dashboard integration",
            "owner": "Arjun Deshmukh",
            "deadline_date": "2026-10-23",
            "deadline_time": "17:00",
            "item_type": "commitment",
            "status": "Pending Approval",
        },
    ],
    "suggestions": [
        {
            "topic": "Dark mode in a future sprint",
            "owner": "Unassigned",
            "owner_status": "ambiguous",
            "deadline": "Unspecified",
            "deadline_status": "missing",
            "item_type": "suggestion",
        },
        {
            "topic": "Notification panel",
            "owner": "Unassigned",
            "owner_status": "ambiguous",
            "deadline": "Unspecified",
            "deadline_status": "missing",
            "item_type": "suggestion",
        },
    ],
    "unresolved_risks_and_dependencies": [
        {
            "topic": "API response format change risk / dependency",
            "is_risk_not_confirmed_conflict": True,
        },
        {
            "topic": "Dashboard build dependency for integration tests",
            "is_risk_not_confirmed_conflict": True,
        },
    ],
}
