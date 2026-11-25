from harbor_langsmith.plugin import LangSmithPlugin


class CompletionFeedback(LangSmithPlugin):
    """Report clean agent completion independently of the code verifier."""

    def _create_feedback(self, run_id, result):
        super()._create_feedback(run_id, result)
        execution = result.agent_execution
        finished = (
            execution is not None
            and execution.finished_at is not None
            and result.agent_result is not None
            and (result.agent_result.metadata or {}).get("clean_terminal_result") is True
            and result.exception_info is None
        )
        key = "agent_finished"
        self._request(
            "POST",
            "/feedback",
            json={
                "id": self._stable_uuid(run_id, "feedback", key),
                "run_id": run_id,
                "key": key,
                "score": int(finished),
                "feedback_source_type": "api",
            },
            ok_statuses={200, 201, 409},
        )
