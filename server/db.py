"""
Neon PostgreSQL Database Layer for CommitFlow
Handles connection pooling, schema migrations, and parameterized queries.
"""

import os
import json
import logging
import uuid
import secrets
from datetime import datetime, timezone, timedelta
from contextlib import contextmanager
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("commitflow.db")
logging.basicConfig(level=logging.INFO)

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# Initialize global connection pool if DATABASE_URL is set
_db_pool = None

def get_connection_url():
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        return None
    # Ensure sslmode=require for Neon PostgreSQL
    if "sslmode=" not in url:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}sslmode=require"
    return url

def init_pool():
    global _db_pool
    url = get_connection_url()
    if not url:
        logger.info("DATABASE_URL not configured. Running in fallback mode.")
        return None
    try:
        _db_pool = pool.ThreadedConnectionPool(minconn=1, maxconn=10, dsn=url)
        logger.info("Neon PostgreSQL connection pool established successfully.")
        return _db_pool
    except Exception as e:
        logger.error(f"Failed to connect to Neon PostgreSQL: {e}")
        _db_pool = None
        return None

@contextmanager
def get_db_cursor(commit=False):
    """Context manager for thread-safe database cursor execution."""
    global _db_pool
    if _db_pool is None:
        init_pool()
    
    if _db_pool is None:
        raise ConnectionError("Database not configured or connection failed.")

    conn = _db_pool.getconn()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        yield cursor
        if commit:
            conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _db_pool.putconn(conn)

def check_connection():
    """Verify database connectivity."""
    url = get_connection_url()
    if not url:
        return False, "DATABASE_URL environment variable is not set."
    try:
        with get_db_cursor(commit=False) as cur:
            cur.execute("SELECT 1 AS alive;")
            row = cur.fetchone()
            if row and row['alive'] == 1:
                return True, "Connected to Neon PostgreSQL successfully."
        return False, "Failed to verify connection."
    except Exception as e:
        return False, f"Connection error: {str(e)}"

def init_schema():
    """
    Initialize relational database tables for transcripts, summaries,
    decisions, action items, and unresolved questions.
    """
    url = get_connection_url()
    if not url:
        return False

    schema_sql = """
    -- 0. Users Table (RBAC: 'user' | 'admin', Status: 'active' | 'deactivated')
    CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'user',
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP WITH TIME ZONE
    );

    -- 0.1 Sessions Table
    CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
    );

    -- 0.2 Audit Logs Table
    CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(64),
        user_email VARCHAR(255),
        action VARCHAR(64) NOT NULL,
        details JSONB DEFAULT '{}',
        ip_address VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 0.3 Platform Settings Table
    CREATE TABLE IF NOT EXISTS platform_settings (
        key VARCHAR(64) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 1. Transcripts Table
    CREATE TABLE IF NOT EXISTS transcripts (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        filename VARCHAR(255),
        file_size VARCHAR(64),
        file_type VARCHAR(32) DEFAULT 'TXT',
        source_type VARCHAR(64) DEFAULT 'Uploaded Transcript',
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(32) NOT NULL DEFAULT 'Uploaded',
        duration VARCHAR(64) DEFAULT 'Calculating...',
        participants TEXT[] DEFAULT '{}',
        raw_text TEXT NOT NULL,
        error_message TEXT,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Safe migration in case transcripts table already exists without user_id
    ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL;

    -- 2. Meeting Summaries Table
    CREATE TABLE IF NOT EXISTS meeting_summaries (
        id SERIAL PRIMARY KEY,
        transcript_id VARCHAR(64) REFERENCES transcripts(id) ON DELETE CASCADE UNIQUE,
        overview TEXT NOT NULL,
        key_discussion_points JSONB NOT NULL DEFAULT '[]',
        outcomes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Confirmed Decisions Table
    CREATE TABLE IF NOT EXISTS decisions (
        id VARCHAR(64) PRIMARY KEY,
        transcript_id VARCHAR(64) REFERENCES transcripts(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        details TEXT,
        evidence_speaker VARCHAR(128),
        evidence_timestamp VARCHAR(32),
        evidence_quote TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Action Items Table (Approval Center)
    CREATE TABLE IF NOT EXISTS action_items (
        id VARCHAR(64) PRIMARY KEY,
        transcript_id VARCHAR(64) REFERENCES transcripts(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        owner VARCHAR(128) DEFAULT 'Unassigned',
        owner_status VARCHAR(32) DEFAULT 'ambiguous',
        deadline VARCHAR(64) DEFAULT 'Unspecified',
        deadline_status VARCHAR(32) DEFAULT 'missing',
        priority VARCHAR(32) DEFAULT 'Medium',
        status VARCHAR(32) DEFAULT 'Pending Approval',
        evidence_speaker VARCHAR(128),
        evidence_timestamp VARCHAR(32),
        evidence_quote TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. Unresolved Questions Table
    CREATE TABLE IF NOT EXISTS unresolved_questions (
        id VARCHAR(64) PRIMARY KEY,
        transcript_id VARCHAR(64) REFERENCES transcripts(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(64) DEFAULT 'Unanswered Question',
        description TEXT,
        evidence TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for fast filtering and status querying
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_transcripts_user ON transcripts(user_id);
    CREATE INDEX IF NOT EXISTS idx_transcripts_status ON transcripts(status);
    CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items(status);
    CREATE INDEX IF NOT EXISTS idx_action_items_transcript ON action_items(transcript_id);
    CREATE INDEX IF NOT EXISTS idx_decisions_transcript ON decisions(transcript_id);
    CREATE INDEX IF NOT EXISTS idx_unresolved_transcript ON unresolved_questions(transcript_id);
    """

    try:
        with get_db_cursor(commit=True) as cur:
            cur.execute(schema_sql)
            logger.info("Neon PostgreSQL schema initialized successfully.")
        
        seed_default_data_if_empty()
        bootstrap_admin_from_env_if_set()
        return True
    except Exception as e:
        logger.error(f"Failed to initialize schema in PostgreSQL: {e}")
        return False

# -------------------------------------------------------------
# Parameterized Database Queries
# -------------------------------------------------------------

def list_transcripts(user_id=None, is_admin=False):
    """Retrieve transcripts sorted by creation date, filtered by user ownership or admin access."""
    if not get_connection_url():
        return None
    with get_db_cursor(commit=False) as cur:
        if is_admin:
            cur.execute("""
                SELECT id, title, filename, file_size as "fileSize", file_type as "fileType",
                       source_type as "sourceType", 
                       to_char(uploaded_at, 'Mon DD, YYYY, HH12:MI AM') as "uploadedAt",
                       status, duration, participants, user_id as "userId",
                       error_message as "errorMessage"
                FROM transcripts
                ORDER BY created_at DESC;
            """)
        elif user_id:
            cur.execute("""
                SELECT id, title, filename, file_size as "fileSize", file_type as "fileType",
                       source_type as "sourceType", 
                       to_char(uploaded_at, 'Mon DD, YYYY, HH12:MI AM') as "uploadedAt",
                       status, duration, participants, user_id as "userId",
                       error_message as "errorMessage"
                FROM transcripts
                WHERE user_id = %s OR user_id IS NULL
                ORDER BY created_at DESC;
            """, (user_id,))
        else:
            cur.execute("""
                SELECT id, title, filename, file_size as "fileSize", file_type as "fileType",
                       source_type as "sourceType", 
                       to_char(uploaded_at, 'Mon DD, YYYY, HH12:MI AM') as "uploadedAt",
                       status, duration, participants, user_id as "userId",
                       error_message as "errorMessage"
                FROM transcripts
                WHERE user_id IS NULL
                ORDER BY created_at DESC;
            """)
        rows = cur.fetchall()
        return [dict(r) for r in rows]

def get_transcript_by_id(transcript_id, user_id=None, is_admin=False):
    """Retrieve complete transcript details with summary, decisions, action items, and unresolved questions."""
    if not get_connection_url():
        return None
    with get_db_cursor(commit=False) as cur:
        # Base transcript
        cur.execute("""
            SELECT id, title, filename, file_size as "fileSize", file_type as "fileType",
                   source_type as "sourceType", 
                   to_char(uploaded_at, 'Mon DD, YYYY, HH12:MI AM') as "uploadedAt",
                   status, duration, participants, raw_text as "transcriptText",
                   user_id as "userId", error_message as "errorMessage"
            FROM transcripts
            WHERE id = %s;
        """, (transcript_id,))
        tx = cur.fetchone()
        if not tx:
            return None
        
        # Access control: if transcript belongs to a user and caller is another user (and not admin)
        if tx.get('userId') is not None and user_id is not None and tx.get('userId') != user_id and not is_admin:
            return {"_forbidden": True}
        
        result = dict(tx)

        # Summary
        cur.execute("""
            SELECT overview, key_discussion_points as "keyDiscussionPoints", outcomes
            FROM meeting_summaries
            WHERE transcript_id = %s;
        """, (transcript_id,))
        sum_row = cur.fetchone()
        result['summary'] = dict(sum_row) if sum_row else None

        # Decisions
        cur.execute("""
            SELECT id, title, details,
                   evidence_speaker, evidence_timestamp, evidence_quote
            FROM decisions
            WHERE transcript_id = %s;
        """, (transcript_id,))
        dec_rows = cur.fetchall()
        result['decisions'] = [
            {
                "id": r['id'],
                "title": r['title'],
                "details": r['details'],
                "evidence": {
                    "speaker": r['evidence_speaker'],
                    "timestamp": r['evidence_timestamp'],
                    "quote": r['evidence_quote']
                } if r['evidence_speaker'] or r['evidence_quote'] else None
            }
            for r in dec_rows
        ]

        # Action Items
        cur.execute("""
            SELECT id, title, description, owner, owner_status as "ownerStatus",
                   deadline, deadline_status as "deadlineStatus", priority, status,
                   evidence_speaker, evidence_timestamp, evidence_quote
            FROM action_items
            WHERE transcript_id = %s;
        """, (transcript_id,))
        act_rows = cur.fetchall()
        result['actionItems'] = [
            {
                "id": r['id'],
                "title": r['title'],
                "description": r['description'],
                "owner": r['owner'],
                "ownerStatus": r['ownerStatus'],
                "deadline": r['deadline'],
                "deadlineStatus": r['deadlineStatus'],
                "priority": r['priority'],
                "status": r['status'],
                "evidence": {
                    "speaker": r['evidence_speaker'],
                    "timestamp": r['evidence_timestamp'],
                    "quote": r['evidence_quote']
                } if r['evidence_speaker'] or r['evidence_quote'] else None,
                "sourceMeetingId": transcript_id,
                "sourceMeetingTitle": result['title']
            }
            for r in act_rows
        ]

        # Unresolved Questions
        cur.execute("""
            SELECT id, title, category, description, evidence
            FROM unresolved_questions
            WHERE transcript_id = %s;
        """, (transcript_id,))
        unres_rows = cur.fetchall()
        result['unresolvedQuestions'] = [dict(r) for r in unres_rows]

        return result

def insert_transcript(tx_data, user_id=None):
    """Insert newly uploaded transcript into database with user ownership."""
    if not get_connection_url():
        return None
    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            INSERT INTO transcripts (
                id, title, filename, file_size, file_type, source_type,
                status, duration, participants, raw_text, user_id
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            ) RETURNING id;
        """, (
            tx_data['id'],
            tx_data['title'],
            tx_data.get('filename'),
            tx_data.get('fileSize'),
            tx_data.get('fileType', 'TXT'),
            tx_data.get('sourceType', 'Uploaded Transcript'),
            tx_data.get('status', 'Processing'),
            tx_data.get('duration', 'Calculating...'),
            tx_data.get('participants', []),
            tx_data['text'],
            user_id
        ))
        return tx_data['id']

def save_analysis_results(transcript_id, analysis_data):
    """Persist structured AI analysis output into relational tables."""
    if not get_connection_url():
        return False
    with get_db_cursor(commit=True) as cur:
        # 1. Update transcript metadata
        duration = analysis_data.get('duration', '25 min')
        participants = analysis_data.get('participants', [])
        cur.execute("""
            UPDATE transcripts
            SET status = 'Processed',
                duration = %s,
                participants = %s,
                error_message = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (duration, participants, transcript_id))

        # 2. Insert or replace summary
        summary = analysis_data.get('summary')
        if summary:
            cur.execute("""
                INSERT INTO meeting_summaries (transcript_id, overview, key_discussion_points, outcomes)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (transcript_id) DO UPDATE SET
                    overview = EXCLUDED.overview,
                    key_discussion_points = EXCLUDED.key_discussion_points,
                    outcomes = EXCLUDED.outcomes;
            """, (
                transcript_id,
                summary.get('overview', ''),
                json.dumps(summary.get('keyDiscussionPoints', [])),
                summary.get('outcomes', '')
            ))

        # 3. Clean and insert decisions
        cur.execute("DELETE FROM decisions WHERE transcript_id = %s;", (transcript_id,))
        decisions = analysis_data.get('decisions', [])
        for d in decisions:
            ev = d.get('evidence') or {}
            cur.execute("""
                INSERT INTO decisions (id, transcript_id, title, details, evidence_speaker, evidence_timestamp, evidence_quote)
                VALUES (%s, %s, %s, %s, %s, %s, %s);
            """, (
                d.get('id') or f"dec-{transcript_id}-{os.urandom(4).hex()}",
                transcript_id,
                d.get('title', ''),
                d.get('details', ''),
                ev.get('speaker', ''),
                ev.get('timestamp', ''),
                ev.get('quote', '')
            ))

        # 4. Clean and insert action items
        cur.execute("DELETE FROM action_items WHERE transcript_id = %s;", (transcript_id,))
        action_items = analysis_data.get('actionItems', [])
        for a in action_items:
            ev = a.get('evidence') or {}
            cur.execute("""
                INSERT INTO action_items (
                    id, transcript_id, title, description, owner, owner_status,
                    deadline, deadline_status, priority, status,
                    evidence_speaker, evidence_timestamp, evidence_quote
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, (
                a.get('id') or f"act-{transcript_id}-{os.urandom(4).hex()}",
                transcript_id,
                a.get('title', ''),
                a.get('description', ''),
                a.get('owner', 'Unassigned'),
                a.get('ownerStatus', 'ambiguous'),
                a.get('deadline', 'Unspecified'),
                a.get('deadlineStatus', 'missing'),
                a.get('priority', 'Medium'),
                a.get('status', 'Pending Approval'),
                ev.get('speaker', ''),
                ev.get('timestamp', ''),
                ev.get('quote', '')
            ))

        # 5. Clean and insert unresolved questions
        cur.execute("DELETE FROM unresolved_questions WHERE transcript_id = %s;", (transcript_id,))
        unresolved = analysis_data.get('unresolvedQuestions', [])
        for u in unresolved:
            cur.execute("""
                INSERT INTO unresolved_questions (id, transcript_id, title, category, description, evidence)
                VALUES (%s, %s, %s, %s, %s, %s);
            """, (
                u.get('id') or f"unres-{transcript_id}-{os.urandom(4).hex()}",
                transcript_id,
                u.get('title', ''),
                u.get('category', 'Unanswered Question'),
                u.get('description', ''),
                u.get('evidence', '')
            ))

        return True

def mark_transcript_failed(transcript_id, error_message):
    """Mark transcript processing as failed with error details."""
    if not get_connection_url():
        return False
    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            UPDATE transcripts
            SET status = 'Failed',
                error_message = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (error_message, transcript_id))
        return True

def list_all_action_items(user_id=None, is_admin=False):
    """Retrieve all action items across permitted transcripts."""
    if not get_connection_url():
        return None
    with get_db_cursor(commit=False) as cur:
        if is_admin:
            cur.execute("""
                SELECT a.id, a.transcript_id as "sourceMeetingId", t.title as "sourceMeetingTitle",
                       a.title, a.description, a.owner, a.owner_status as "ownerStatus",
                       a.deadline, a.deadline_status as "deadlineStatus", a.priority, a.status,
                       a.evidence_speaker, a.evidence_timestamp, a.evidence_quote
                FROM action_items a
                JOIN transcripts t ON a.transcript_id = t.id
                ORDER BY a.created_at DESC;
            """)
        elif user_id:
            cur.execute("""
                SELECT a.id, a.transcript_id as "sourceMeetingId", t.title as "sourceMeetingTitle",
                       a.title, a.description, a.owner, a.owner_status as "ownerStatus",
                       a.deadline, a.deadline_status as "deadlineStatus", a.priority, a.status,
                       a.evidence_speaker, a.evidence_timestamp, a.evidence_quote
                FROM action_items a
                JOIN transcripts t ON a.transcript_id = t.id
                WHERE t.user_id = %s OR t.user_id IS NULL
                ORDER BY a.created_at DESC;
            """, (user_id,))
        else:
            cur.execute("""
                SELECT a.id, a.transcript_id as "sourceMeetingId", t.title as "sourceMeetingTitle",
                       a.title, a.description, a.owner, a.owner_status as "ownerStatus",
                       a.deadline, a.deadline_status as "deadlineStatus", a.priority, a.status,
                       a.evidence_speaker, a.evidence_timestamp, a.evidence_quote
                FROM action_items a
                JOIN transcripts t ON a.transcript_id = t.id
                WHERE t.user_id IS NULL
                ORDER BY a.created_at DESC;
            """)
        rows = cur.fetchall()
        items = []
        for r in rows:
            items.append({
                "id": r['id'],
                "title": r['title'],
                "description": r['description'],
                "owner": r['owner'],
                "ownerStatus": r['ownerStatus'],
                "deadline": r['deadline'],
                "deadlineStatus": r['deadlineStatus'],
                "priority": r['priority'],
                "status": r['status'],
                "sourceMeetingId": r['sourceMeetingId'],
                "sourceMeetingTitle": r['sourceMeetingTitle'],
                "evidence": {
                    "speaker": r['evidence_speaker'],
                    "timestamp": r['evidence_timestamp'],
                    "quote": r['evidence_quote']
                } if r['evidence_speaker'] or r['evidence_quote'] else None
            })
        return items

def update_action_item_status(action_id, new_status):
    """Update approval status (Approved, Rejected, Pending Approval)."""
    if not get_connection_url():
        return False
    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            UPDATE action_items
            SET status = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (new_status, action_id))
        return cur.rowcount > 0

def edit_action_item(action_id, updates):
    """Edit action item details."""
    if not get_connection_url():
        return False
    with get_db_cursor(commit=True) as cur:
        owner = updates.get('owner')
        owner_status = 'ambiguous' if owner == 'Unassigned' else 'confirmed' if owner else None
        deadline = updates.get('deadline')
        deadline_status = 'missing' if deadline == 'Unspecified' else 'confirmed' if deadline else None

        cur.execute("""
            UPDATE action_items
            SET title = COALESCE(%s, title),
                owner = COALESCE(%s, owner),
                owner_status = COALESCE(%s, owner_status),
                deadline = COALESCE(%s, deadline),
                deadline_status = COALESCE(%s, deadline_status),
                priority = COALESCE(%s, priority),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (
            updates.get('title'),
            owner,
            owner_status,
            deadline,
            deadline_status,
            updates.get('priority'),
            action_id
        ))
        return cur.rowcount > 0

def seed_default_data_if_empty():
    """Seed initial demonstration records if database table is brand new."""
    try:
        with get_db_cursor(commit=True) as cur:
            cur.execute("SELECT COUNT(*) as count FROM transcripts;")
            res = cur.fetchone()
            if res and res['count'] > 0:
                return  # Already has data

            logger.info("Database is empty. Seeding initial demonstration records into Neon...")
            
            # Seed Transcript 1: Acme Corp Cloud Migration
            tx1_id = "tx-acme-cloud"
            cur.execute("""
                INSERT INTO transcripts (id, title, filename, file_size, file_type, source_type, status, duration, participants, raw_text)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, (
                tx1_id,
                "Acme Corp Cloud Migration & Security Architecture",
                "acme_cloud_architecture_meeting.txt",
                "42.8 KB",
                "TXT",
                "Uploaded Transcript",
                "Processed",
                "48 min",
                ["Alex Rivera", "David Chen", "Elena Rostova", "Rachel Green"],
                "[00:01:10] Alex Rivera: Good morning everyone. Today we are reviewing the cloud migration architecture for Acme Corp.\n[00:08:14] Alex Rivera: We're locking in Amazon EKS for the primary hosting tier with multi-AZ resilience.\n[00:15:30] David Chen: I will document the IAM security roles and permission boundary specifications by next Wednesday.\n[00:24:50] David Chen: Agreed, we will set S3 lifecycle policies to retain all compliance and API audit logs for 90 days.\n[00:32:15] Elena Rostova: I'll prepare the database backup and failover runbook draft and share it with security by Thursday.\n[00:44:10] Rachel Green: Someone on QA or ops should benchmark latency against our SLA before the client review."
            ))

            cur.execute("""
                INSERT INTO meeting_summaries (transcript_id, overview, key_discussion_points, outcomes)
                VALUES (%s, %s, %s, %s);
            """, (
                tx1_id,
                "The engineering and operations team convened to finalize the cloud infrastructure migration roadmap for Acme Corp. The discussion covered AWS Kubernetes cluster provisioning, database migration and replication strategies, IAM security policies, and 90-day compliance log retention.",
                json.dumps([
                    "Kubernetes cluster provisioning on AWS with automated Terraform manifests.",
                    "PostgreSQL database failover and automated point-in-time recovery (PITR) testing.",
                    "IAM role-based access control (RBAC) and compliance audit logging for 90 days."
                ]),
                "Consensus reached on architecture framework. Security audit checklist and database failover plan will be prepared for executive sign-off before Thursday."
            ))

            cur.execute("""
                INSERT INTO decisions (id, transcript_id, title, details, evidence_speaker, evidence_timestamp, evidence_quote)
                VALUES 
                ('dec-acme-1', %s, 'Adopt Amazon EKS for Primary Microservices Hosting', 'The team confirmed deploying microservices on Amazon EKS using multi-AZ worker nodes.', 'Alex Rivera', '00:08:14', 'We''re locking in Amazon EKS for the primary hosting tier with multi-AZ resilience.'),
                ('dec-acme-2', %s, 'Retain Compliance and Audit Logs for 90 Days', 'Audit trails and CloudTrail event logs will be stored in an encrypted S3 bucket with a 90-day lifecycle rule.', 'David Chen', '00:24:50', 'Agreed, we will set S3 lifecycle policies to retain all compliance and API audit logs for 90 days.');
            """, (tx1_id, tx1_id))

            cur.execute("""
                INSERT INTO action_items (id, transcript_id, title, description, owner, owner_status, deadline, deadline_status, priority, status, evidence_speaker, evidence_timestamp, evidence_quote)
                VALUES 
                ('act-acme-1', %s, 'Prepare AWS IAM security roles and permissions specification', 'Document least-privilege role definitions and access policies for EKS worker nodes.', 'David Chen', 'confirmed', '2026-10-28', 'confirmed', 'High', 'Pending Approval', 'David Chen', '00:15:30', 'I will document the IAM security roles and permission boundary specifications by next Wednesday.'),
                ('act-acme-2', %s, 'Draft PostgreSQL multi-region failover and backup recovery runbook', 'Prepare step-by-step procedures for database replication testing and cross-region failover.', 'Elena Rostova', 'confirmed', '2026-10-29', 'confirmed', 'High', 'Approved', 'Elena Rostova', '00:32:15', 'I''ll prepare the database backup and failover runbook draft and share it with security by Thursday.'),
                ('act-acme-3', %s, 'Review staging benchmark latency against SLAs', 'Conduct stress testing on staging clusters to ensure p99 latency stays under 120ms.', 'Unassigned', 'ambiguous', 'Unspecified', 'missing', 'Medium', 'Pending Approval', 'Rachel Green', '00:44:10', 'Someone on QA or ops should benchmark latency against our SLA before the client review.');
            """, (tx1_id, tx1_id, tx1_id))

            cur.execute("""
                INSERT INTO unresolved_questions (id, transcript_id, title, category, description, evidence)
                VALUES 
                ('unres-acme-1', %s, 'Unassigned Performance Benchmark Owner', 'Missing Owner', 'Rachel suggested benchmarking latency against SLAs, but no engineer committed to taking ownership.', 'Rachel Green (00:44:10): "Someone on QA or ops should benchmark latency against our SLA."');
            """, (tx1_id,))

            logger.info("Default seed data successfully populated in Neon PostgreSQL.")
    except Exception as e:
        logger.warning(f"Seeding skipped or encountered error: {e}")

# -------------------------------------------------------------
# User Authentication & RBAC Management
# -------------------------------------------------------------

def bootstrap_admin_from_env_if_set():
    """
    Ensure an initial administrator exists.
    Checks environment variables (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME).
    If no admin exists in the database, provisions a default initial admin.
    """
    if not get_connection_url():
        return
    
    admin_email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    admin_password = os.getenv("ADMIN_PASSWORD", "").strip()
    admin_name = os.getenv("ADMIN_NAME", "System Administrator").strip()

    try:
        with get_db_cursor(commit=True) as cur:
            # If explicit credentials are provided via environment
            if admin_email and admin_password:
                cur.execute("SELECT id, role, status FROM users WHERE email = %s;", (admin_email,))
                existing = cur.fetchone()
                if existing:
                    if existing['role'] != 'admin' or existing['status'] != 'active':
                        cur.execute("""
                            UPDATE users SET role = 'admin', status = 'active', updated_at = CURRENT_TIMESTAMP
                            WHERE id = %s;
                        """, (existing['id'],))
                        logger.info(f"Existing account '{admin_email}' promoted to active administrator via environment.")
                else:
                    admin_id = f"usr-adm-{uuid.uuid4().hex[:10]}"
                    pwd_hash = generate_password_hash(admin_password)
                    cur.execute("""
                        INSERT INTO users (id, name, email, password_hash, role, status)
                        VALUES (%s, %s, %s, %s, 'admin', 'active');
                    """, (admin_id, admin_name, admin_email, pwd_hash))
                    logger.info(f"Bootstrapped administrator account '{admin_email}' from environment.")
                return

            # If no env admin specified, check if any active administrator exists at all
            cur.execute("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND status = 'active';")
            res = cur.fetchone()
            if not res or res['count'] == 0:
                default_admin_email = "admin@commitflow.dev"
                default_admin_pwd = "Admin@CommitFlow2026!"
                default_admin_name = "CommitFlow Admin"
                cur.execute("SELECT id FROM users WHERE email = %s;", (default_admin_email,))
                if not cur.fetchone():
                    admin_id = f"usr-adm-{uuid.uuid4().hex[:10]}"
                    pwd_hash = generate_password_hash(default_admin_pwd)
                    cur.execute("""
                        INSERT INTO users (id, name, email, password_hash, role, status)
                        VALUES (%s, %s, %s, %s, 'admin', 'active');
                    """, (admin_id, default_admin_name, default_admin_email, pwd_hash))
                    logger.info(f"Provisioned initial system admin '{default_admin_email}'.")
    except Exception as e:
        logger.warning(f"Admin bootstrap notice: {e}")

def create_user(name, email, password, role="user"):
    """
    Register a new user account.
    Public registration strictly assigns role='user'.
    """
    if not get_connection_url():
        raise ConnectionError("Database not connected.")
    
    name = (name or "").strip()
    email = (email or "").strip().lower()
    if not name:
        raise ValueError("Full name is required.")
    if not email or "@" not in email:
        raise ValueError("A valid email address is required.")
    if not password or len(password) < 6:
        raise ValueError("Password must be at least 6 characters.")
    
    # Strictly validate role
    if role not in ("user", "admin"):
        role = "user"

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id FROM users WHERE email = %s;", (email,))
        if cur.fetchone():
            raise ValueError("An account with this email already exists.")

        user_id = f"usr-{uuid.uuid4().hex[:12]}"
        password_hash = generate_password_hash(password)

        cur.execute("""
            INSERT INTO users (id, name, email, password_hash, role, status)
            VALUES (%s, %s, %s, %s, %s, 'active')
            RETURNING id, name, email, role, status, created_at;
        """, (user_id, name, email, password_hash, role))
        user = dict(cur.fetchone())

        # Audit log
        cur.execute("""
            INSERT INTO audit_logs (user_id, user_email, action, details)
            VALUES (%s, %s, 'USER_REGISTERED', %s);
        """, (user['id'], user['email'], json.dumps({"role": role, "name": name})))

        return user

def authenticate_user(email, password, ip_address=None):
    """
    Authenticate user with email and password.
    Returns (success, message, user_dict_or_None).
    """
    if not get_connection_url():
        return False, "Database connection unavailable.", None
    
    email = (email or "").strip().lower()
    if not email or not password:
        return False, "Email and password are required.", None

    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            SELECT id, name, email, password_hash, role, status,
                   to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as "createdAt",
                   to_char(last_login_at, 'YYYY-MM-DD HH24:MI:SS') as "lastLoginAt"
            FROM users
            WHERE email = %s;
        """, (email,))
        user_row = cur.fetchone()

        if not user_row:
            cur.execute("""
                INSERT INTO audit_logs (user_email, action, details, ip_address)
                VALUES (%s, 'LOGIN_FAILED', '{"reason": "User not found"}', %s);
            """, (email, ip_address))
            return False, "Invalid email or password.", None

        if not check_password_hash(user_row['password_hash'], password):
            cur.execute("""
                INSERT INTO audit_logs (user_id, user_email, action, details, ip_address)
                VALUES (%s, %s, 'LOGIN_FAILED', '{"reason": "Invalid credentials"}', %s);
            """, (user_row['id'], email, ip_address))
            return False, "Invalid email or password.", None

        if user_row['status'] == 'deactivated':
            cur.execute("""
                INSERT INTO audit_logs (user_id, user_email, action, details, ip_address)
                VALUES (%s, %s, 'LOGIN_BLOCKED', '{"reason": "Account deactivated"}', %s);
            """, (user_row['id'], email, ip_address))
            return False, "This account has been deactivated. Please contact an administrator.", None

        # Update last login
        cur.execute("""
            UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = %s;
        """, (user_row['id'],))

        cur.execute("""
            INSERT INTO audit_logs (user_id, user_email, action, details, ip_address)
            VALUES (%s, %s, 'LOGIN_SUCCESS', %s, %s);
        """, (user_row['id'], email, json.dumps({"role": user_row['role']}), ip_address))

        clean_user = {
            "id": user_row['id'],
            "name": user_row['name'],
            "email": user_row['email'],
            "role": user_row['role'],
            "status": user_row['status'],
            "createdAt": user_row['createdAt'],
            "lastLoginAt": user_row['lastLoginAt']
        }
        return True, "Login successful.", clean_user

def get_user_by_id(user_id):
    """Retrieve user details without password hash."""
    if not get_connection_url():
        return None
    with get_db_cursor(commit=False) as cur:
        cur.execute("""
            SELECT id, name, email, role, status,
                   to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as "createdAt",
                   to_char(last_login_at, 'YYYY-MM-DD HH24:MI:SS') as "lastLoginAt"
            FROM users
            WHERE id = %s;
        """, (user_id,))
        row = cur.fetchone()
        return dict(row) if row else None

def list_users(search=None, role=None, status=None, limit=100, offset=0):
    """List registered users with optional filters and meeting counts."""
    if not get_connection_url():
        return []
    with get_db_cursor(commit=False) as cur:
        query = """
            SELECT u.id, u.name, u.email, u.role, u.status,
                   to_char(u.created_at, 'YYYY-MM-DD HH24:MI:SS') as "createdAt",
                   to_char(u.last_login_at, 'YYYY-MM-DD HH24:MI:SS') as "lastLoginAt",
                   (SELECT COUNT(*) FROM transcripts t WHERE t.user_id = u.id) as "meetingsCount"
            FROM users u
            WHERE 1=1
        """
        params = []
        if search:
            query += " AND (u.name ILIKE %s OR u.email ILIKE %s)"
            params.extend([f"%{search}%", f"%{search}%"])
        if role and role in ('user', 'admin'):
            query += " AND u.role = %s"
            params.append(role)
        if status and status in ('active', 'deactivated'):
            query += " AND u.status = %s"
            params.append(status)
        
        query += " ORDER BY u.created_at DESC LIMIT %s OFFSET %s;"
        params.extend([limit, offset])

        cur.execute(query, tuple(params))
        rows = cur.fetchall()
        return [dict(r) for r in rows]

def count_active_admins():
    """Count currently active administrators."""
    if not get_connection_url():
        return 0
    with get_db_cursor(commit=False) as cur:
        cur.execute("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND status = 'active';")
        res = cur.fetchone()
        return res['count'] if res else 0

def update_user_status(user_id, new_status, actor_admin=None):
    """
    Activate or deactivate a user account.
    Safeguard: prevents deactivating the last active administrator.
    """
    if not get_connection_url():
        raise ConnectionError("Database not connected.")
    if new_status not in ('active', 'deactivated'):
        raise ValueError("Invalid status. Must be 'active' or 'deactivated'.")

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id, name, email, role, status FROM users WHERE id = %s;", (user_id,))
        target = cur.fetchone()
        if not target:
            raise ValueError(f"User '{user_id}' not found.")

        # Last active administrator protection
        if target['role'] == 'admin' and new_status == 'deactivated':
            cur.execute("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND status = 'active';")
            count = cur.fetchone()['count']
            if count <= 1:
                raise ValueError("Cannot deactivate the last active administrator. System requires at least one active admin.")

        cur.execute("""
            UPDATE users SET status = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s;
        """, (new_status, user_id))

        # Invalidate sessions if deactivated
        if new_status == 'deactivated':
            cur.execute("DELETE FROM sessions WHERE user_id = %s;", (user_id,))

        actor_id = actor_admin['id'] if actor_admin else None
        actor_email = actor_admin['email'] if actor_admin else 'system'
        cur.execute("""
            INSERT INTO audit_logs (user_id, user_email, action, details)
            VALUES (%s, %s, 'USER_STATUS_CHANGE', %s);
        """, (actor_id, actor_email, json.dumps({
            "targetUserId": user_id,
            "targetEmail": target['email'],
            "oldStatus": target['status'],
            "newStatus": new_status
        })))

        return True

def update_user_role(user_id, new_role, actor_admin=None):
    """
    Change user role (user <-> admin).
    Safeguard: prevents demoting the last active administrator.
    """
    if not get_connection_url():
        raise ConnectionError("Database not connected.")
    if new_role not in ('user', 'admin'):
        raise ValueError("Invalid role. Must be 'user' or 'admin'.")

    with get_db_cursor(commit=True) as cur:
        cur.execute("SELECT id, name, email, role, status FROM users WHERE id = %s;", (user_id,))
        target = cur.fetchone()
        if not target:
            raise ValueError(f"User '{user_id}' not found.")

        # Last active administrator protection
        if target['role'] == 'admin' and target['status'] == 'active' and new_role != 'admin':
            cur.execute("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND status = 'active';")
            count = cur.fetchone()['count']
            if count <= 1:
                raise ValueError("Cannot demote the last active administrator. System requires at least one active admin.")

        cur.execute("""
            UPDATE users SET role = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s;
        """, (new_role, user_id))

        actor_id = actor_admin['id'] if actor_admin else None
        actor_email = actor_admin['email'] if actor_admin else 'system'
        cur.execute("""
            INSERT INTO audit_logs (user_id, user_email, action, details)
            VALUES (%s, %s, 'USER_ROLE_CHANGE', %s);
        """, (actor_id, actor_email, json.dumps({
            "targetUserId": user_id,
            "targetEmail": target['email'],
            "oldRole": target['role'],
            "newRole": new_role
        })))

        return True

# -------------------------------------------------------------
# Session Management
# -------------------------------------------------------------

def create_session(user_id, duration_days=7):
    """Generate and store a secure session token."""
    if not get_connection_url():
        return None, None
    token = secrets.token_urlsafe(48)
    expires_at = datetime.now(timezone.utc) + timedelta(days=duration_days)

    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            INSERT INTO sessions (id, user_id, expires_at)
            VALUES (%s, %s, %s);
        """, (token, user_id, expires_at))
    return token, expires_at

def get_session_user(token):
    """Validate session token and return user data if active and valid."""
    if not get_connection_url() or not token:
        return None
    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            SELECT s.id as "sessionId", s.expires_at as "expiresAt",
                   u.id, u.name, u.email, u.role, u.status,
                   to_char(u.created_at, 'YYYY-MM-DD HH24:MI:SS') as "createdAt",
                   to_char(u.last_login_at, 'YYYY-MM-DD HH24:MI:SS') as "lastLoginAt"
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = %s;
        """, (token,))
        row = cur.fetchone()
        if not row:
            return None
        
        # Check expiration
        now = datetime.now(timezone.utc)
        if row['expiresAt'] < now:
            cur.execute("DELETE FROM sessions WHERE id = %s;", (token,))
            return None
        
        # Check if user is deactivated
        if row['status'] != 'active':
            cur.execute("DELETE FROM sessions WHERE id = %s;", (token,))
            return None

        return {
            "id": row['id'],
            "name": row['name'],
            "email": row['email'],
            "role": row['role'],
            "status": row['status'],
            "createdAt": row['createdAt'],
            "lastLoginAt": row['lastLoginAt']
        }

def delete_session(token):
    """Invalidate a specific session."""
    if not get_connection_url() or not token:
        return False
    with get_db_cursor(commit=True) as cur:
        cur.execute("DELETE FROM sessions WHERE id = %s;", (token,))
        return cur.rowcount > 0

def delete_user_sessions(user_id):
    """Invalidate all sessions for a user (e.g. on deactivation)."""
    if not get_connection_url() or not user_id:
        return False
    with get_db_cursor(commit=True) as cur:
        cur.execute("DELETE FROM sessions WHERE user_id = %s;", (user_id,))
        return True

# -------------------------------------------------------------
# Audit Logs
# -------------------------------------------------------------

def log_audit_event(user_id, user_email, action, details=None, ip_address=None):
    """Store an unmodifiable audit record."""
    if not get_connection_url():
        return False
    try:
        with get_db_cursor(commit=True) as cur:
            cur.execute("""
                INSERT INTO audit_logs (user_id, user_email, action, details, ip_address)
                VALUES (%s, %s, %s, %s, %s);
            """, (user_id, user_email, action, json.dumps(details or {}), ip_address))
            return True
    except Exception as e:
        logger.error(f"Failed to record audit event: {e}")
        return False

def list_audit_logs(limit=100, offset=0, action_filter=None):
    """Retrieve recent audit logs."""
    if not get_connection_url():
        return []
    with get_db_cursor(commit=False) as cur:
        query = """
            SELECT id, user_id as "userId", user_email as "userEmail",
                   action, details, ip_address as "ipAddress",
                   to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as "createdAt"
            FROM audit_logs
        """
        params = []
        if action_filter:
            query += " WHERE action = %s"
            params.append(action_filter)
        query += " ORDER BY created_at DESC LIMIT %s OFFSET %s;"
        params.extend([limit, offset])

        cur.execute(query, tuple(params))
        rows = cur.fetchall()
        return [dict(r) for r in rows]

# -------------------------------------------------------------
# Admin Stats & Platform Overview
# -------------------------------------------------------------

def get_admin_stats():
    """Calculate platform-wide analytics directly from Neon PostgreSQL."""
    if not get_connection_url():
        return None
    with get_db_cursor(commit=False) as cur:
        stats = {}

        # Users
        cur.execute("""
            SELECT 
                COUNT(*) as total_users,
                COUNT(*) FILTER (WHERE status = 'active') as active_users,
                COUNT(*) FILTER (WHERE status = 'deactivated') as deactivated_users,
                COUNT(*) FILTER (WHERE role = 'admin') as admin_users,
                COUNT(*) FILTER (WHERE role = 'user') as standard_users
            FROM users;
        """)
        u_row = cur.fetchone() or {}
        stats.update(u_row)

        # Transcripts / Meetings
        cur.execute("""
            SELECT 
                COUNT(*) as total_meetings,
                COUNT(*) FILTER (WHERE status = 'Processed') as processed_meetings,
                COUNT(*) FILTER (WHERE status = 'Processing') as processing_meetings,
                COUNT(*) FILTER (WHERE status = 'Failed') as failed_meetings
            FROM transcripts;
        """)
        t_row = cur.fetchone() or {}
        stats.update(t_row)

        # Action Items
        cur.execute("""
            SELECT 
                COUNT(*) as total_action_items,
                COUNT(*) FILTER (WHERE status = 'Approved') as approved_action_items,
                COUNT(*) FILTER (WHERE status = 'Pending Approval') as pending_action_items,
                COUNT(*) FILTER (WHERE status = 'Rejected') as rejected_action_items
            FROM action_items;
        """)
        a_row = cur.fetchone() or {}
        stats.update(a_row)

        # Decisions
        cur.execute("SELECT COUNT(*) as total_decisions FROM decisions;")
        d_row = cur.fetchone() or {}
        stats.update(d_row)

        # Recent Platform Activity
        cur.execute("""
            SELECT id, user_email as "userEmail", action, details,
                   to_char(created_at, 'Mon DD, YYYY HH12:MI AM') as "createdAt"
            FROM audit_logs
            ORDER BY created_at DESC
            LIMIT 8;
        """)
        stats['recent_activity'] = [dict(r) for r in cur.fetchall()]

        return stats

def get_admin_meetings_overview(limit=50, offset=0):
    """Retrieve meeting metadata for administrator oversight."""
    if not get_connection_url():
        return []
    with get_db_cursor(commit=False) as cur:
        cur.execute("""
            SELECT t.id, t.title, t.filename, t.file_size as "fileSize",
                   t.source_type as "sourceType", t.status, t.duration,
                   to_char(t.uploaded_at, 'Mon DD, YYYY, HH12:MI AM') as "uploadedAt",
                   t.user_id as "userId",
                   COALESCE(u.name, 'System Seed') as "creatorName",
                   COALESCE(u.email, 'system@commitflow.internal') as "creatorEmail",
                   (SELECT COUNT(*) FROM action_items a WHERE a.transcript_id = t.id) as "actionItemsCount",
                   (SELECT COUNT(*) FROM decisions d WHERE d.transcript_id = t.id) as "decisionsCount"
            FROM transcripts t
            LEFT JOIN users u ON t.user_id = u.id
            ORDER BY t.created_at DESC
            LIMIT %s OFFSET %s;
        """, (limit, offset))
        return [dict(r) for r in cur.fetchall()]

# -------------------------------------------------------------
# Platform Settings
# -------------------------------------------------------------

def get_platform_settings():
    """Retrieve platform configuration settings."""
    defaults = {
        "allow_public_registration": True,
        "default_session_days": 7,
        "require_task_approval": True,
        "max_transcript_size_mb": 15,
        "platform_name": "CommitFlow Enterprise",
        "maintenance_mode": False
    }
    if not get_connection_url():
        return defaults
    try:
        with get_db_cursor(commit=False) as cur:
            cur.execute("SELECT key, value FROM platform_settings;")
            rows = cur.fetchall()
            for r in rows:
                defaults[r['key']] = r['value']
        return defaults
    except Exception as e:
        logger.warning(f"Failed to load platform settings: {e}")
        return defaults

def update_platform_settings(new_settings, actor_admin=None):
    """Update platform configuration."""
    if not get_connection_url():
        raise ConnectionError("Database not connected.")
    with get_db_cursor(commit=True) as cur:
        for key, val in new_settings.items():
            cur.execute("""
                INSERT INTO platform_settings (key, value, updated_at)
                VALUES (%s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (key) DO UPDATE
                SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
            """, (key, json.dumps(val) if not isinstance(val, (int, float, str, bool, dict, list)) else json.dumps(val)))

        actor_id = actor_admin['id'] if actor_admin else None
        actor_email = actor_admin['email'] if actor_admin else 'system'
        cur.execute("""
            INSERT INTO audit_logs (user_id, user_email, action, details)
            VALUES (%s, %s, 'PLATFORM_SETTINGS_UPDATED', %s);
        """, (actor_id, actor_email, json.dumps({"updatedKeys": list(new_settings.keys())})))

        return True
