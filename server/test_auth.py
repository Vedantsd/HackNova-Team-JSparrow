import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server.app import app
import json

client = app.test_client()

print("[1] Testing public registration...")
reg_res = client.post('/api/auth/register', json={
    'name': 'Test User One',
    'email': 'testuser1@example.com',
    'password': 'TestPassword123!',
    'confirmPassword': 'TestPassword123!'
})
print('Register status:', reg_res.status_code)
assert reg_res.status_code in (201, 400), f'Unexpected reg status: {reg_res.status_code}'
if reg_res.status_code == 201:
    user_data = reg_res.get_json()['user']
    assert user_data['role'] == 'user', f"Public signup role was not user: {user_data['role']}"
    print("Registration role verified strictly as: 'user'")

print("[2] Testing user login...")
login_res = client.post('/api/auth/login', json={
    'email': 'testuser1@example.com',
    'password': 'TestPassword123!'
})
assert login_res.status_code == 200, f'Login failed: {login_res.get_json()}'
user_token = login_res.get_json()['token']
print("User login successful. Token acquired.")

print("[3] Testing RBAC: normal user accessing admin endpoint...")
admin_access_res = client.get('/api/admin/stats', headers={'Authorization': f'Bearer {user_token}'})
assert admin_access_res.status_code == 403, f'Expected 403, got {admin_access_res.status_code}'
print("RBAC check passed: normal user correctly denied with 403 Forbidden.")

print("[4] Testing unauthenticated request to admin endpoint...")
client.delete_cookie('cf_session')
unauth_res = client.get('/api/admin/stats')
assert unauth_res.status_code == 401, f'Expected 401, got {unauth_res.status_code}'
print("Auth check passed: unauthenticated request correctly rejected with 401 Unauthorized.")

print("[5] Testing Admin login...")
admin_login_res = client.post('/api/auth/login', json={
    'email': 'admin@commitflow.dev',
    'password': 'Admin@CommitFlow2026!'
})
assert admin_login_res.status_code == 200, f'Admin login failed: {admin_login_res.get_json()}'
admin_token = admin_login_res.get_json()['token']
print("Admin login successful.")

print("[6] Testing Admin stats & system health endpoints...")
stats_res = client.get('/api/admin/stats', headers={'Authorization': f'Bearer {admin_token}'})
assert stats_res.status_code == 200
stats = stats_res.get_json()
print(f"Stats retrieved: {stats.get('total_users')} users, {stats.get('total_meetings')} meetings")

health_res = client.get('/api/admin/system-health', headers={'Authorization': f'Bearer {admin_token}'})
assert health_res.status_code == 200
print("System health status:", health_res.get_json()['status'])

print("[7] Testing Admin safeguard: preventing demoting/deactivating last admin...")
admin_users_res = client.get('/api/admin/users', headers={'Authorization': f'Bearer {admin_token}'})
admin_user_id = [u for u in admin_users_res.get_json()['users'] if u['email'] == 'admin@commitflow.dev'][0]['id']
demote_res = client.put(f'/api/admin/users/{admin_user_id}/role', json={'role': 'user'}, headers={'Authorization': f'Bearer {admin_token}'})
assert demote_res.status_code == 400, f'Expected 400 when demoting last admin, got {demote_res.status_code}'
print(f"Admin safeguard passed: {demote_res.get_json()['error']}")

print("\n>>> ALL 7 BACKEND AUTH & RBAC INTEGRATION TESTS PASSED SUCCESSFULLY! <<<\n")
