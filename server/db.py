"""
Neon PostgreSQL Database Layer for CommitFlow
Handles connection pooling, schema migrations, and parameterized queries.
"""

import os
import json
import logging
from datetime import datetime, timezone
from contextlib import contextmanager
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
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
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

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
        return True
    except Exception as e:
        logger.error(f"Failed to initialize schema in PostgreSQL: {e}")
        return False

# -------------------------------------------------------------
# Parameterized Database Queries
# -------------------------------------------------------------

def list_transcripts():
    """Retrieve all transcripts sorted by creation date."""
    if not get_connection_url():
        return None
    with get_db_cursor(commit=False) as cur:
        cur.execute("""
            SELECT id, title, filename, file_size as "fileSize", file_type as "fileType",
                   source_type as "sourceType", 
                   to_char(uploaded_at, 'Mon DD, YYYY, HH12:MI AM') as "uploadedAt",
                   status, duration, participants, error_message as "errorMessage"
            FROM transcripts
            ORDER BY created_at DESC;
        """)
        rows = cur.fetchall()
        return [dict(r) for r in rows]

def get_transcript_by_id(transcript_id):
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
                   error_message as "errorMessage"
            FROM transcripts
            WHERE id = %s;
        """, (transcript_id,))
        tx = cur.fetchone()
        if not tx:
            return None
        
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

def insert_transcript(tx_data):
    """Insert newly uploaded transcript into database."""
    if not get_connection_url():
        return None
    with get_db_cursor(commit=True) as cur:
        cur.execute("""
            INSERT INTO transcripts (
                id, title, filename, file_size, file_type, source_type,
                status, duration, participants, raw_text
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
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
            tx_data['text']
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

def list_all_action_items():
    """Retrieve all action items across all transcripts."""
    if not get_connection_url():
        return None
    with get_db_cursor(commit=False) as cur:
        cur.execute("""
            SELECT a.id, a.transcript_id as "sourceMeetingId", t.title as "sourceMeetingTitle",
                   a.title, a.description, a.owner, a.owner_status as "ownerStatus",
                   a.deadline, a.deadline_status as "deadlineStatus", a.priority, a.status,
                   a.evidence_speaker, a.evidence_timestamp, a.evidence_quote
            FROM action_items a
            JOIN transcripts t ON a.transcript_id = t.id
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
