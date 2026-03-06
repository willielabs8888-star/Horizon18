"""
Authentication module for Horizon18.

Handles JWT creation/validation, password hashing, Google OAuth,
and route decorators for protected endpoints.
"""

from __future__ import annotations

import os
import time
from functools import wraps

import bcrypt
import jwt
import requests
from flask import request, jsonify, g

JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-in-production")
JWT_EXPIRY_SECONDS = 86400  # 24 hours

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")


# ── Password Hashing ──────────────────────────────────────────────

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def check_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


# ── JWT ────────────────────────────────────────────────────────────

def create_jwt(user_id: int, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": int(time.time()) + JWT_EXPIRY_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_jwt(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


# ── Route Decorators ──────────────────────────────────────────────

def auth_required(f):
    """Decorator: requires valid JWT. Sets g.user_id and g.email."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Authentication required"}), 401

        token = auth_header[7:]
        payload = decode_jwt(token)
        if not payload:
            return jsonify({"error": "Invalid or expired token"}), 401

        g.user_id = payload["user_id"]
        g.email = payload["email"]
        return f(*args, **kwargs)
    return decorated


def auth_optional(f):
    """Decorator: sets g.user_id if valid JWT present, else None."""
    @wraps(f)
    def decorated(*args, **kwargs):
        g.user_id = None
        g.email = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            payload = decode_jwt(auth_header[7:])
            if payload:
                g.user_id = payload["user_id"]
                g.email = payload["email"]
        return f(*args, **kwargs)
    return decorated


# ── Google OAuth ──────────────────────────────────────────────────

def exchange_google_token(id_token: str) -> dict | None:
    """Verify a Google ID token and return user info.

    The frontend uses Google Sign-In (GSI) which provides an ID token
    directly — no auth code exchange needed.
    """
    try:
        resp = requests.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
            timeout=5,
        )
        if resp.status_code != 200:
            return None

        info = resp.json()

        # Verify the token was issued for our app
        if info.get("aud") != GOOGLE_CLIENT_ID:
            return None

        return {
            "email": info["email"],
            "google_id": info["sub"],
            "name": info.get("name", info["email"].split("@")[0]),
        }
    except Exception:
        return None
