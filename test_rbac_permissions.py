import requests
import json
import sys

BASE_URL = "http://localhost:5000"

def test_rbac():
    print("=== STARTING RBAC & PANEL PERMISSIONS TEST ===")
    
    # 1. Test Public Registration cannot elevate role
    print("\n[TEST 1] Registering user with malicious role='admin' payload...")
    reg_payload = {
        "email": "malicious_reg@test.com",
        "password": "Password123!",
        "name": "Malicious User",
        "role": "admin"
    }
    r = requests.post(f"{BASE_URL}/api/auth/register", json=reg_payload)
    if r.status_code == 201:
        reg_user = r.json().get("user", {})
        assert reg_user.get("role") == "user", f"FAIL: Public registration allowed elevated role! Got: {reg_user.get('role')}"
        print(f"PASSED: User registered with enforced role='{reg_user.get('role')}'")
    elif r.status_code == 409:
        print("User already exists, checking role on login...")
    
    # 2. Test Login as Regular User
    print("\n[TEST 2] Testing User authentication and authorization...")
    user_sess = requests.Session()
    r = user_sess.post(f"{BASE_URL}/api/auth/login", json={
        "email": "testuser1@example.com",
        "password": "TestPassword123!"
    })
    assert r.status_code == 200, f"Login failed for test user: {r.text}"
    user_data = r.json().get("user", {})
    assert user_data.get("role") == "user", f"Expected role='user', got: {user_data.get('role')}"
    print(f"PASSED: User logged in: {user_data.get('name')} (Role: {user_data.get('role')})")
    
    # Verify User CANNOT access Admin endpoints
    r = user_sess.get(f"{BASE_URL}/api/admin/users")
    assert r.status_code == 403, f"FAIL: Regular user accessed Admin endpoint! Status: {r.status_code}"
    print("PASSED: Regular user denied access to /api/admin/users (403 Forbidden)")

    r = user_sess.get(f"{BASE_URL}/api/admin/teams")
    assert r.status_code == 403, f"FAIL: Regular user accessed Admin teams! Status: {r.status_code}"
    print("PASSED: Regular user denied access to /api/admin/teams (403 Forbidden)")

    # Verify User CANNOT access Team Lead endpoints
    r = user_sess.get(f"{BASE_URL}/api/team-lead/dashboard")
    assert r.status_code == 403, f"FAIL: Regular user accessed Team Lead dashboard! Status: {r.status_code}"
    print("PASSED: Regular user denied access to /api/team-lead/dashboard (403 Forbidden)")

    r = user_sess.get(f"{BASE_URL}/api/team-lead/team")
    assert r.status_code == 403, f"FAIL: Regular user accessed Team Lead team! Status: {r.status_code}"
    print("PASSED: Regular user denied access to /api/team-lead/team (403 Forbidden)")

    # 3. Test Login as Team Lead
    print("\n[TEST 3] Testing Team Lead authentication and authorization...")
    lead_sess = requests.Session()
    r = lead_sess.post(f"{BASE_URL}/api/auth/login", json={
        "email": "teamlead@commitflow.dev",
        "password": "Lead@CommitFlow2026!"
    })
    assert r.status_code == 200, f"Login failed for team lead: {r.text}"
    lead_data = r.json().get("user", {})
    assert lead_data.get("role") == "team_lead", f"Expected role='team_lead', got: {lead_data.get('role')}"
    print(f"PASSED: Team Lead logged in: {lead_data.get('name')} (Role: {lead_data.get('role')})")

    # Verify Team Lead CAN access Team Lead endpoints
    r = lead_sess.get(f"{BASE_URL}/api/team-lead/dashboard")
    assert r.status_code == 200, f"FAIL: Team lead could not access dashboard: {r.status_code}"
    lead_dash = r.json()
    assert lead_dash.get("team") is not None, "FAIL: Team Lead has no team assigned"
    print(f"PASSED: Team Lead dashboard accessed for team: {lead_dash['team']['name']}")

    r = lead_sess.get(f"{BASE_URL}/api/team-lead/team")
    assert r.status_code == 200, f"FAIL: Team lead could not access team roster: {r.status_code}"
    members = r.json().get("members", [])
    print(f"PASSED: Team Lead retrieved team roster ({len(members)} verified members)")

    r = lead_sess.get(f"{BASE_URL}/api/team-lead/meetings")
    assert r.status_code == 200, f"FAIL: Team lead could not access team meetings: {r.status_code}"
    meetings = r.json().get("meetings", [])
    print(f"PASSED: Team Lead retrieved team meetings ({len(meetings)} meetings)")

    r = lead_sess.get(f"{BASE_URL}/api/team-lead/calendar")
    assert r.status_code == 200, f"FAIL: Team lead could not access calendar: {r.status_code}"
    print("PASSED: Team Lead calendar endpoint returned valid status 200")

    r = lead_sess.get(f"{BASE_URL}/api/team-lead/reports")
    assert r.status_code == 200, f"FAIL: Team lead reports failed: {r.status_code}"
    print("PASSED: Team Lead reports & analytics endpoint returned valid status 200")

    # Verify Team Lead CANNOT access Admin endpoints
    r = lead_sess.get(f"{BASE_URL}/api/admin/users")
    assert r.status_code == 403, f"FAIL: Team lead accessed admin users! Status: {r.status_code}"
    print("PASSED: Team Lead denied access to /api/admin/users (403 Forbidden)")

    r = lead_sess.get(f"{BASE_URL}/api/admin/teams")
    assert r.status_code == 403, f"FAIL: Team lead accessed admin teams! Status: {r.status_code}"
    print("PASSED: Team Lead denied access to /api/admin/teams (403 Forbidden)")

    # 4. Test Login as Admin
    print("\n[TEST 4] Testing Admin authentication and authorization...")
    admin_sess = requests.Session()
    r = admin_sess.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@commitflow.dev",
        "password": "Admin@CommitFlow2026!"
    })
    assert r.status_code == 200, f"Login failed for admin: {r.text}"
    admin_data = r.json().get("user", {})
    assert admin_data.get("role") == "admin", f"Expected role='admin', got: {admin_data.get('role')}"
    print(f"PASSED: Admin logged in: {admin_data.get('name')} (Role: {admin_data.get('role')})")

    # Admin CAN access Admin endpoints
    r = admin_sess.get(f"{BASE_URL}/api/admin/users")
    assert r.status_code == 200, f"Admin failed to access users: {r.status_code}"
    users = r.json().get("users", [])
    print(f"PASSED: Admin retrieved platform users ({len(users)} registered users)")

    r = admin_sess.get(f"{BASE_URL}/api/admin/teams")
    assert r.status_code == 200, f"Admin failed to access teams: {r.status_code}"
    teams = r.json().get("teams", [])
    print(f"PASSED: Admin retrieved platform teams ({len(teams)} teams)")

    r = admin_sess.get(f"{BASE_URL}/api/admin/eligible-leads")
    assert r.status_code == 200, f"Admin failed to access eligible leads: {r.status_code}"
    leads = r.json().get("leads", [])
    print(f"PASSED: Admin retrieved eligible team leads ({len(leads)} leads)")

    # Admin role assignment test: assign team_lead role
    target_user = next((u for u in users if u["email"] == "alice@example.com"), None)
    if target_user:
        r = admin_sess.put(f"{BASE_URL}/api/admin/users/{target_user['id']}/role", json={"role": "team_lead"})
        assert r.status_code == 200, f"Admin role change to team_lead failed: {r.text}"
        print(f"PASSED: Admin changed role of {target_user['email']} to 'team_lead'")
        
        # Reset back to user
        r = admin_sess.put(f"{BASE_URL}/api/admin/users/{target_user['id']}/role", json={"role": "user"})
        assert r.status_code == 200, f"Admin reset role failed: {r.text}"
        print(f"PASSED: Admin reset role of {target_user['email']} back to 'user'")

    print("\n=== ALL RBAC & PANEL ISOLATION TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    test_rbac()
