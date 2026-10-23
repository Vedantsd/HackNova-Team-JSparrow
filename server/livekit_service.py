"""
LiveKit Cloud Integration Service for CommitFlow
Handles server-side AccessToken generation, credential validation,
and permission mapping using the official LiveKit Python SDK.
"""

import os
import json
import logging
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("commitflow.livekit")

try:
    from livekit.api import AccessToken, VideoGrants
    LIVEKIT_SDK_AVAILABLE = True
except ImportError:
    LIVEKIT_SDK_AVAILABLE = False
    logger.warning("livekit-api package not installed. LiveKit functionality will be unavailable.")

def get_livekit_config():
    """Retrieve LiveKit configuration from environment variables."""
    url = os.getenv("LIVEKIT_URL", "").strip()
    api_key = os.getenv("LIVEKIT_API_KEY", "").strip()
    api_secret = os.getenv("LIVEKIT_API_SECRET", "").strip()
    return url, api_key, api_secret

def is_livekit_configured():
    """Check if all required LiveKit credentials are set."""
    url, api_key, api_secret = get_livekit_config()
    return bool(url and api_key and api_secret and LIVEKIT_SDK_AVAILABLE)

def check_livekit_status():
    """
    Safely inspect LiveKit configuration status without revealing secrets.
    Returns (is_ok: bool, message: str).
    """
    if not LIVEKIT_SDK_AVAILABLE:
        return False, "livekit-api Python package is not installed."
    url, api_key, api_secret = get_livekit_config()
    if not url:
        return False, "LIVEKIT_URL environment variable is missing."
    if not api_key:
        return False, "LIVEKIT_API_KEY environment variable is missing."
    if not api_secret:
        return False, "LIVEKIT_API_SECRET environment variable is missing."
    if not (url.startswith("wss://") or url.startswith("ws://")):
        return False, "LIVEKIT_URL must start with wss:// or ws://"
    return True, f"LiveKit Cloud configured ({url})"

def generate_meeting_token(meeting_id, room_name, user_id, user_name, user_role="user"):
    """
    Generate a cryptographically signed LiveKit AccessToken for a participant.
    
    Args:
        meeting_id (str): Database meeting ID
        room_name (str): LiveKit room identifier
        user_id (str): Authenticated user ID (server-side verified identity)
        user_name (str): Participant display name
        user_role (str): 'user' or 'admin'
        
    Returns:
        dict: {"serverUrl": str, "token": str, "roomName": str}
    """
    if not LIVEKIT_SDK_AVAILABLE:
        raise RuntimeError("LiveKit Python SDK is not installed on the server.")

    url, api_key, api_secret = get_livekit_config()
    if not (url and api_key and api_secret):
        raise ValueError("LiveKit Cloud credentials are not configured on the server. Please set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.")

    # Minimum necessary permissions: join specified room, publish audio/video, subscribe, and publish data (chat/hand)
    grant = VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
        can_publish_data=True
    )

    metadata = json.dumps({
        "role": user_role,
        "meetingId": meeting_id
    })

    # Short-lived token with 2-hour TTL
    token_builder = (
        AccessToken(api_key, api_secret)
        .with_identity(user_id)
        .with_name(user_name or f"User-{user_id[:6]}")
        .with_metadata(metadata)
        .with_grants(grant)
        .with_ttl(timedelta(hours=2))
    )

    jwt_token = token_builder.to_jwt()

    # Never return api_key or api_secret!
    return {
        "serverUrl": url,
        "token": jwt_token,
        "roomName": room_name
    }
