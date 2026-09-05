from app.core.security import generate_interview_token, hash_token, verify_token


def test_token_hash_and_verify() -> None:
    token = generate_interview_token()
    token_hash = hash_token(token)

    assert token != token_hash
    assert verify_token(token, token_hash)
    assert not verify_token("invalid-token", token_hash)
