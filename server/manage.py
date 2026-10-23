"""
CommitFlow Management CLI
Administrative operations: creating administrators, inspecting users, and auditing.
Usage:
    python server/manage.py create-admin --name "Admin Name" --email "admin@example.com" --password "SecurePassword123"
    python server/manage.py list-users
    python server/manage.py promote-user --email "user@example.com"
    python server/manage.py stats
"""

import os
import sys
import argparse
from dotenv import load_dotenv

load_dotenv()

# Ensure server module is importable
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

try:
    from server import db
except ImportError:
    import db

def cmd_create_admin(args):
    name = args.name
    email = args.email
    password = args.password

    if not name:
        name = input("Enter Admin Full Name: ").strip()
    if not email:
        email = input("Enter Admin Email: ").strip()
    if not password:
        import getpass
        password = getpass.getpass("Enter Admin Password: ").strip()

    if not name or not email or not password:
        print("[Error] Name, email, and password are required.")
        sys.exit(1)

    try:
        user = db.create_user(name=name, email=email, password=password, role="admin")
        print(f"[Success] Administrator created successfully!")
        print(f"  ID:    {user['id']}")
        print(f"  Name:  {user['name']}")
        print(f"  Email: {user['email']}")
        print(f"  Role:  {user['role']}")
    except Exception as e:
        print(f"[Error] Failed to create admin: {e}")
        sys.exit(1)

def cmd_promote_user(args):
    email = args.email
    if not email:
        email = input("Enter user email to promote: ").strip()
    
    with db.get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id, name, role FROM users WHERE email = %s;", (email.strip().lower(),))
        u = cur.fetchone()
        if not u:
            print(f"[Error] No user found with email '{email}'.")
            sys.exit(1)
        
        db.update_user_role(u['id'], 'admin')
        print(f"[Success] User '{u['name']}' ({email}) has been promoted to Administrator.")

def cmd_list_users(args):
    users = db.list_users(limit=100)
    if not users:
        print("No registered users found.")
        return

    print(f"\n{'ID':<18} | {'Name':<22} | {'Email':<30} | {'Role':<8} | {'Status':<10} | {'Meetings':<8}")
    print("-" * 105)
    for u in users:
        print(f"{u['id']:<18} | {u['name'][:20]:<22} | {u['email'][:28]:<30} | {u['role']:<8} | {u['status']:<10} | {u['meetingsCount']:<8}")
    print()

def cmd_stats(args):
    stats = db.get_admin_stats()
    if not stats:
        print("Unable to fetch stats. Check database connection.")
        return
    print("\n=== CommitFlow Platform Statistics ===")
    print(f"Total Users:        {stats.get('total_users', 0)} (Active: {stats.get('active_users', 0)}, Deactivated: {stats.get('deactivated_users', 0)})")
    print(f"Admins:             {stats.get('admin_users', 0)}")
    print(f"Total Meetings:     {stats.get('total_meetings', 0)}")
    print(f"Total Action Items: {stats.get('total_action_items', 0)} (Approved: {stats.get('approved_action_items', 0)}, Pending: {stats.get('pending_action_items', 0)})")
    print(f"Total Decisions:    {stats.get('total_decisions', 0)}")
    print("=======================================\n")

def main():
    parser = argparse.ArgumentParser(description="CommitFlow Management Utility")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # create-admin
    p_admin = subparsers.add_parser("create-admin", help="Provision a new system administrator")
    p_admin.add_argument("--name", help="Admin's full name")
    p_admin.add_argument("--email", help="Admin's email address")
    p_admin.add_argument("--password", help="Admin's password")

    # promote-user
    p_promote = subparsers.add_parser("promote-user", help="Promote an existing user to admin")
    p_promote.add_argument("--email", required=True, help="Email of user to promote")

    # list-users
    subparsers.add_parser("list-users", help="List all registered accounts")

    # stats
    subparsers.add_parser("stats", help="Display platform statistics")

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(0)

    if args.command == "create-admin":
        cmd_create_admin(args)
    elif args.command == "promote-user":
        cmd_promote_user(args)
    elif args.command == "list-users":
        cmd_list_users(args)
    elif args.command == "stats":
        cmd_stats(args)

if __name__ == "__main__":
    main()
