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
    if getattr(conn, 'closed', 0) != 0:
        try:
            _db_pool.putconn(conn, close=True)
        except Exception:
            pass
        conn = _db_pool.getconn()

    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        yield cursor
        if commit:
            conn.commit()
    except Exception:
        try:
            if getattr(conn, 'closed', 0) == 0:
                conn.rollback()
        except Exception:
            pass
        raise
    finally:
        try:
            _db_pool.putconn(conn, close=bool(getattr(conn, 'closed', 0) != 0))
        except Exception:
            pass

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

    -- 0.4 Meetings Table (LiveKit room mapping & lifecycle)
    CREATE TABLE IF NOT EXISTS meetings (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        room_name VARCHAR(128) NOT NULL UNIQUE,
        host_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'live',
        is_private BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- 0.5 Meeting Participants Table
    CREATE TABLE IF NOT EXISTS meeting_participants (
        id SERIAL PRIMARY KEY,
        meeting_id VARCHAR(64) REFERENCES meetings(id) ON DELETE CASCADE,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(32) NOT NULL DEFAULT 'participant',
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(meeting_id, user_id)
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
    CREATE INDEX IF NOT EXISTS idx_meetings_room ON meetings(room_name);
    CREATE INDEX IF NOT EXISTS idx_meetings_host ON meetings(host_id);
    CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);
    CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting ON meeting_participants(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_meeting_participants_user ON meeting_participants(user_id);
    """

    try:
        with get_db_cursor(commit=True) as cur:
            cur.execute(schema_sql)
            logger.info("Neon PostgreSQL schema initialized successfully.")
        
        seed_default_data_if_empty()
        seed_default_meetings()
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

# -------------------------------------------------------------
# Meeting & LiveKit Real-Time Sessions
# -------------------------------------------------------------

def seed_default_meetings():
    """Seed initial demonstration meetings and calendar schedule."""
    if not get_connection_url():
        return
    try:
        with get_db_cursor(commit=True) as cur:
            # Ensure columns exist
            cur.execute("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;")
            cur.execute("ALTER TABLE meetings ADD COLUMN IF NOT EXISTS duration VARCHAR(64);")
            cur.execute("ALTER TABLE meeting_participants ADD COLUMN IF NOT EXISTS attended BOOLEAN;")

            demo_meetings = [
                ("q4-strategy", "Q4 Product Strategy Review", "cf-room-q4-strategy", "live", False, "2026-10-23 10:00:00+00", "45 min"),
                ("eng-sprint", "Engineering Sprint Planning", "cf-room-eng-sprint", "done", False, "2026-10-22 14:30:00+00", "1h 15min"),
                ("client-acme", "Client Onboarding - Acme Corp", "cf-room-client-acme", "done", False, "2026-10-22 10:00:00+00", "52 min"),
                ("weekly-standup", "Weekly Team Standup", "cf-room-weekly-standup", "done", False, "2026-10-15 09:00:00+00", "28 min"),
                ("quarterly-budget", "Q4 Budget Alignment Call", "cf-room-quarterly-budget", "done", False, "2026-10-12 15:30:00+00", "45 min"),
                ("vendor-audit", "Third-Party Vendor Compliance Check", "cf-room-vendor-audit", "cancelled", False, "2026-10-19 13:00:00+00", "30 min"),
                ("design-review", "Design Review Session", "cf-room-design-review", "scheduled", False, "2026-10-26 11:00:00+00", "45 min"),
                ("investor-update", "Investor Update Call", "cf-room-investor-update", "scheduled", False, "2026-10-28 14:00:00+00", "30 min"),
                ("lead-sync", "1:1 with Engineering Lead", "cf-room-lead-sync", "scheduled", False, "2026-10-30 16:30:00+00", "30 min"),
                ("mobile-app-launch", "Mobile App Launch Readiness", "cf-room-mobile-app-launch", "scheduled", False, "2026-11-04 10:00:00+00", "1h"),
            ]
            for m_id, title, r_name, status, is_priv, sched, dur in demo_meetings:
                cur.execute("""
                    INSERT INTO meetings (id, title, room_name, status, is_private, scheduled_at, duration)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        scheduled_at = COALESCE(meetings.scheduled_at, EXCLUDED.scheduled_at),
                        duration = COALESCE(meetings.duration, EXCLUDED.duration),
                        status = CASE WHEN meetings.status = 'live' THEN 'live' ELSE EXCLUDED.status END;
                """, (m_id, title, r_name, status, is_priv, sched, dur))

            # Seed reliable sample attendance for all active users so calendar indicators are populated
            cur.execute("SELECT id FROM users;")
            users = cur.fetchall()
            for u in users:
                u_id = u["id"]
                # eng-sprint: attended = True
                cur.execute("""
                    INSERT INTO meeting_participants (meeting_id, user_id, role, joined_at, attended)
                    VALUES ('eng-sprint', %s, 'participant', '2026-10-22 14:32:00+00', TRUE)
                    ON CONFLICT (meeting_id, user_id) DO UPDATE SET attended = TRUE;
                """, (u_id,))
                # quarterly-budget: attended = False (missed)
                cur.execute("""
                    INSERT INTO meeting_participants (meeting_id, user_id, role, joined_at, attended)
                    VALUES ('quarterly-budget', %s, 'participant', NULL, FALSE)
                    ON CONFLICT (meeting_id, user_id) DO UPDATE SET attended = FALSE, joined_at = NULL;
                """, (u_id,))
                # weekly-standup: attended = True
                cur.execute("""
                    INSERT INTO meeting_participants (meeting_id, user_id, role, joined_at, attended)
                    VALUES ('weekly-standup', %s, 'participant', '2026-10-15 09:02:00+00', TRUE)
                    ON CONFLICT (meeting_id, user_id) DO UPDATE SET attended = TRUE;
                """, (u_id,))
                # Note: client-acme is intentionally omitted from meeting_participants for this user to test 'Attendance unknown'
            logger.info("Demo meetings and calendar schedule seeded successfully.")
    except Exception as e:
        logger.warning(f"Error seeding demo meetings: {e}")

def create_meeting(title, host_id=None, is_private=False, meeting_id=None, room_name=None):
    """
    Create a new meeting record in Neon PostgreSQL.
    Assigns a stable, unique room_name for LiveKit.
    """
    if not get_connection_url():
        raise ConnectionError("Database not connected.")

    m_id = meeting_id or f"m-{uuid.uuid4().hex[:8]}"
    r_name = room_name or f"cf-room-{m_id}"

    with get_db_cursor(commit=True) as cur:
        # Check if meeting_id already exists to prevent duplicate insertion
        cur.execute("SELECT id, title, room_name, host_id, status, is_private, created_at FROM meetings WHERE id = %s;", (m_id,))
        existing = cur.fetchone()
        if existing:
            return dict(existing)

        cur.execute("""
            INSERT INTO meetings (id, title, room_name, host_id, status, is_private)
            VALUES (%s, %s, %s, %s, 'live', %s)
            RETURNING id, title, room_name, host_id, status, is_private, created_at;
        """, (m_id, title, r_name, host_id, is_private))
        meeting = dict(cur.fetchone())

        # If host is assigned, register in participants
        if host_id:
            cur.execute("""
                INSERT INTO meeting_participants (meeting_id, user_id, role)
                VALUES (%s, %s, 'host')
                ON CONFLICT (meeting_id, user_id) DO NOTHING;
            """, (m_id, host_id))

        return meeting

def get_meeting_by_id(meeting_id):
    """
    Retrieve meeting metadata by meeting ID or LiveKit room name.
    Includes host information and participant count.
    """
    if not get_connection_url():
        return None

    with get_db_cursor(commit=False) as cur:
        cur.execute("""
            SELECT m.id, m.title, m.room_name as "roomName", m.host_id as "hostId",
                   m.status, m.is_private as "isPrivate",
                   to_char(m.created_at, 'Mon DD, YYYY, HH12:MI AM') as "createdAt",
                   u.name as "hostName", u.email as "hostEmail",
                   (SELECT COUNT(*) FROM meeting_participants mp WHERE mp.meeting_id = m.id) as "participantCount"
            FROM meetings m
            LEFT JOIN users u ON m.host_id = u.id
            WHERE m.id = %s OR m.room_name = %s;
        """, (meeting_id, meeting_id))
        row = cur.fetchone()
        if not row:
            return None
        return dict(row)

def get_or_create_meeting(meeting_id, title=None, host_id=None, is_private=False):
    """
    Retrieve meeting by ID, or create it if not found (used for demo IDs or direct links).
    """
    existing = get_meeting_by_id(meeting_id)
    if existing:
        return existing
    
    clean_title = title or f"Meeting {meeting_id}"
    return create_meeting(clean_title, host_id=host_id, is_private=is_private, meeting_id=meeting_id)

def list_meetings(user_id=None, is_admin=False):
    """
    Retrieve meetings accessible to the user:
    - Admins: All meetings with participant counts
    - Users: Public meetings + meetings created by user + meetings user is invited to
    """
    if not get_connection_url():
        return []

    with get_db_cursor(commit=False) as cur:
        if is_admin:
            cur.execute("""
                SELECT m.id, m.title, m.room_name as "roomName", m.host_id as "hostId",
                       m.status, m.is_private as "isPrivate",
                       to_char(m.created_at, 'Mon DD, YYYY, HH12:MI AM') as "createdAt",
                       u.name as "hostName", u.email as "hostEmail",
                       (SELECT COUNT(*) FROM meeting_participants mp WHERE mp.meeting_id = m.id) as "participantCount"
                FROM meetings m
                LEFT JOIN users u ON m.host_id = u.id
                ORDER BY m.created_at DESC;
            """)
        elif user_id:
            cur.execute("""
                SELECT DISTINCT m.id, m.title, m.room_name as "roomName", m.host_id as "hostId",
                       m.status, m.is_private as "isPrivate",
                       to_char(m.created_at, 'Mon DD, YYYY, HH12:MI AM') as "createdAt",
                       u.name as "hostName", u.email as "hostEmail",
                       (SELECT COUNT(*) FROM meeting_participants mp2 WHERE mp2.meeting_id = m.id) as "participantCount"
                FROM meetings m
                LEFT JOIN users u ON m.host_id = u.id
                LEFT JOIN meeting_participants mp ON mp.meeting_id = m.id
                WHERE m.is_private = FALSE 
                   OR m.host_id = %s 
                   OR mp.user_id = %s
                ORDER BY m.created_at DESC;
            """, (user_id, user_id))
        else:
            cur.execute("""
                SELECT m.id, m.title, m.room_name as "roomName", m.host_id as "hostId",
                       m.status, m.is_private as "isPrivate",
                       to_char(m.created_at, 'Mon DD, YYYY, HH12:MI AM') as "createdAt",
                       u.name as "hostName",
                       (SELECT COUNT(*) FROM meeting_participants mp WHERE mp.meeting_id = m.id) as "participantCount"
                FROM meetings m
                LEFT JOIN users u ON m.host_id = u.id
                WHERE m.is_private = FALSE
                ORDER BY m.created_at DESC;
            """)
        rows = cur.fetchall()
        return [dict(r) for r in rows]

def can_user_access_meeting(meeting_id, user_id, is_admin=False):
    """
    Check if a user is permitted to obtain a LiveKit real-time token for a meeting.
    Admins can see metadata in admin panel, but do not automatically enter private audio/video rooms without explicit invitation.
    Returns (allowed: bool, reason: str, meeting: dict or None).
    """
    meeting = get_meeting_by_id(meeting_id)
    if not meeting:
        return False, "Meeting not found.", None

    # Public meetings can be joined by any authenticated user
    if not meeting.get("isPrivate"):
        return True, "Access granted.", meeting

    # Private meeting: user must be the host or invited participant
    if meeting.get("hostId") and meeting["hostId"] == user_id:
        return True, "Access granted as meeting host.", meeting

    if not get_connection_url():
        return False, "Database not connected.", None

    with get_db_cursor(commit=False) as cur:
        cur.execute("""
            SELECT 1 FROM meeting_participants
            WHERE meeting_id = %s AND user_id = %s;
        """, (meeting["id"], user_id))
        if cur.fetchone():
            return True, "Access granted as invited participant.", meeting

    # Admin without participant invitation cannot join private meeting room video/audio
    if is_admin:
        return False, "Administrators cannot join private meeting audio/video without invitation.", meeting

    return False, "You are not authorized to join this private meeting.", meeting

def add_meeting_participant(meeting_id, user_id, role="participant"):
    """Register participant in meeting."""
    if not get_connection_url():
        return False
    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            INSERT INTO meeting_participants (meeting_id, user_id, role)
            VALUES (%s, %s, %s)
            ON CONFLICT (meeting_id, user_id) DO NOTHING;
        """, (meeting_id, user_id, role))
        return True

def get_calendar_meetings(user_id=None, year=None, month=None, is_admin=False):
    """
    Retrieve meetings for the given month (and adjacent padding days) with attendance status
    for the specified user.
    Enforces meeting visibility permissions:
    - Admin: all meetings
    - User: public meetings + meetings user created or is participant of
    """
    import calendar as py_calendar

    try:
        current_dt = datetime.now(timezone.utc)
        target_year = int(year) if year is not None else current_dt.year
        target_month = int(month) if month is not None else current_dt.month
        
        if target_month < 1 or target_month > 12:
            target_month = current_dt.month
        if target_year < 1970 or target_year > 2100:
            target_year = current_dt.year
    except (ValueError, TypeError):
        current_dt = datetime.now(timezone.utc)
        target_year = current_dt.year
        target_month = current_dt.month

    if not get_connection_url():
        # Fallback in-memory demo data
        return [
            {"id": "q4-strategy", "title": "Q4 Product Strategy Review", "date": f"{target_year:04d}-{target_month:02d}-23", "time": "10:00 AM", "status": "live", "statusLabel": "Live", "attendance": "live", "attendanceLabel": "Live Now", "duration": "45 min", "participantCount": 8, "hostName": "Alex Rivera", "isPrivate": False},
            {"id": "eng-sprint", "title": "Engineering Sprint Planning", "date": f"{target_year:04d}-{target_month:02d}-22", "time": "02:30 PM", "status": "done", "statusLabel": "Ended", "attendance": "attended", "attendanceLabel": "Attended", "duration": "1h 15min", "participantCount": 12, "hostName": "David Chen", "isPrivate": False},
            {"id": "client-acme", "title": "Client Onboarding - Acme Corp", "date": f"{target_year:04d}-{target_month:02d}-22", "time": "10:00 AM", "status": "done", "statusLabel": "Ended", "attendance": "unknown", "attendanceLabel": "Attendance unknown", "duration": "52 min", "participantCount": 5, "hostName": "Rachel Green", "isPrivate": False},
            {"id": "weekly-standup", "title": "Weekly Team Standup", "date": f"{target_year:04d}-{target_month:02d}-15", "time": "09:00 AM", "status": "done", "statusLabel": "Ended", "attendance": "attended", "attendanceLabel": "Attended", "duration": "28 min", "participantCount": 15, "hostName": "Sarah Nguyen", "isPrivate": False},
            {"id": "quarterly-budget", "title": "Q4 Budget Alignment Call", "date": f"{target_year:04d}-{target_month:02d}-12", "time": "03:30 PM", "status": "done", "statusLabel": "Ended", "attendance": "missed", "attendanceLabel": "Missed", "duration": "45 min", "participantCount": 6, "hostName": "Elena Rostova", "isPrivate": False},
            {"id": "vendor-audit", "title": "Third-Party Vendor Compliance Check", "date": f"{target_year:04d}-{target_month:02d}-19", "time": "01:00 PM", "status": "cancelled", "statusLabel": "Cancelled", "attendance": "cancelled", "attendanceLabel": "Cancelled", "duration": "30 min", "participantCount": 4, "hostName": "Security Officer", "isPrivate": False},
            {"id": "design-review", "title": "Design Review Session", "date": f"{target_year:04d}-{target_month:02d}-26", "time": "11:00 AM", "status": "scheduled", "statusLabel": "Upcoming", "attendance": "none", "attendanceLabel": "Scheduled", "duration": "45 min", "participantCount": 6, "hostName": "Maria Kim", "isPrivate": False},
            {"id": "investor-update", "title": "Investor Update Call", "date": f"{target_year:04d}-{target_month:02d}-28", "time": "02:00 PM", "status": "scheduled", "statusLabel": "Upcoming", "attendance": "none", "attendanceLabel": "Scheduled", "duration": "30 min", "participantCount": 4, "hostName": "Alex Rivera", "isPrivate": False},
            {"id": "lead-sync", "title": "1:1 with Engineering Lead", "date": f"{target_year:04d}-{target_month:02d}-30", "time": "04:30 PM", "status": "scheduled", "statusLabel": "Upcoming", "attendance": "none", "attendanceLabel": "Scheduled", "duration": "30 min", "participantCount": 2, "hostName": "James Chen", "isPrivate": False}
        ]

    _, last_day = py_calendar.monthrange(target_year, target_month)
    start_date = f"{target_year:04d}-{target_month:02d}-01"
    end_date = f"{target_year:04d}-{target_month:02d}-{last_day:02d}"

    with get_db_cursor(commit=False) as cur:
        query = """
            SELECT m.id, m.title, m.room_name as "roomName", m.host_id as "hostId",
                   m.status, m.is_private as "isPrivate",
                   m.duration,
                   COALESCE(m.scheduled_at, m.created_at) as "eventTimestamp",
                   to_char(COALESCE(m.scheduled_at, m.created_at), 'YYYY-MM-DD') as "date",
                   to_char(COALESCE(m.scheduled_at, m.created_at), 'HH12:MI AM') as "time",
                   u.name as "hostName", u.email as "hostEmail",
                   (SELECT COUNT(*) FROM meeting_participants mp_cnt WHERE mp_cnt.meeting_id = m.id) as "participantCount",
                   mp_user.attended as "userAttended",
                   mp_user.joined_at as "userJoinedAt",
                   mp_user.role as "userRole"
            FROM meetings m
            LEFT JOIN users u ON m.host_id = u.id
            LEFT JOIN meeting_participants mp_user ON (mp_user.meeting_id = m.id AND mp_user.user_id = %s)
            WHERE (
                COALESCE(m.scheduled_at, m.created_at) >= (%s::date - INTERVAL '7 days')
                AND COALESCE(m.scheduled_at, m.created_at) <= (%s::date + INTERVAL '7 days')
            )
        """
        params = [user_id, start_date, end_date]

        if not is_admin:
            if user_id:
                query += """
                    AND (
                        m.is_private = FALSE
                        OR m.host_id = %s
                        OR mp_user.user_id IS NOT NULL
                    )
                """
                params.append(user_id)
            else:
                query += " AND m.is_private = FALSE"

        query += " ORDER BY COALESCE(m.scheduled_at, m.created_at) ASC;"

        cur.execute(query, tuple(params))
        rows = cur.fetchall()

        results = []
        for r in rows:
            m = dict(r)
            m_status = (m.get("status") or "scheduled").lower()
            
            # Attendance determination according to requirements:
            # - If user joined or attended the meeting according to recorded data: show Attended
            # - If the meeting ended and user was expected to attend but did not: show Missed
            # - If no reliable attendance record or no way to determine: show Attendance unknown
            # - Upcoming meetings: Upcoming or Scheduled
            # - Cancelled: Cancelled
            if m_status == "cancelled":
                attendance = "cancelled"
                attendance_label = "Cancelled"
                status_label = "Cancelled"
            elif m_status in ("scheduled", "upcoming"):
                attendance = "none"
                attendance_label = "Scheduled"
                status_label = "Upcoming"
            elif m_status == "live":
                attendance = "live"
                attendance_label = "Live Now"
                status_label = "Live"
            else:
                # Ended meeting ('done' or 'ended')
                status_label = "Ended"
                if m.get("userAttended") is True or m.get("userJoinedAt") is not None:
                    attendance = "attended"
                    attendance_label = "Attended"
                elif m.get("userAttended") is False or (m.get("userJoinedAt") is None and m.get("userRole") is not None):
                    attendance = "missed"
                    attendance_label = "Missed"
                else:
                    attendance = "unknown"
                    attendance_label = "Attendance unknown"

            results.append({
                "id": m["id"],
                "title": m["title"],
                "roomName": m.get("roomName"),
                "date": m.get("date"),
                "time": m.get("time") or "TBD",
                "scheduledAt": m["eventTimestamp"].isoformat() if m.get("eventTimestamp") else None,
                "status": m_status,
                "statusLabel": status_label,
                "duration": m.get("duration") or "30 min",
                "participantCount": m.get("participantCount") or 0,
                "hostName": m.get("hostName") or "Host",
                "isPrivate": bool(m.get("isPrivate", False)),
                "attendance": attendance,
                "attendanceLabel": attendance_label
            })

        return results


