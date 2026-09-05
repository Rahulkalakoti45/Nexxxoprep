import hashlib
import secrets
from uuid import uuid4


def generate_interview_token() -> str:
    return str(uuid4())


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def verify_token(raw_token: str, token_hash: str) -> bool:
    candidate_hash = hash_token(raw_token)
    return secrets.compare_digest(candidate_hash, token_hash)
