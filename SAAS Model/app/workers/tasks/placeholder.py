from app.workers.celery_app import celery_app


@celery_app.task(name="placeholder.candidate_invitation")
def candidate_invitation_placeholder():
    return {"status": "placeholder"}


@celery_app.task(name="placeholder.recruiter_summary")
def recruiter_summary_placeholder():
    return {"status": "placeholder"}
