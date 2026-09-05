from app.api.v1.schemas.integration import YashShortlistPayload


def test_yash_shortlist_payload_contract() -> None:
    payload = YashShortlistPayload(
        candidate_id="123",
        name="Rahul Sharma",
        email="rahul@gmail.com",
        phone="9876543210",
        resume_score=91,
        shortlist_reasons=["Production ML Systems", "Vector Databases", "Retrieval Systems"],
        interview_topics=["RAG", "FAISS", "Semantic Search"],
    )
    assert payload.candidate_id == "123"
    assert len(payload.shortlist_reasons) == 3
