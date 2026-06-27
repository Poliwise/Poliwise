from uuid import UUID
from typing import Optional
from datetime import datetime
import structlog

from ..config.rabbitmq import publisher

logger = structlog.get_logger()


class ViolationPublisher:
    """Publishes violation events when Layer 1 blocks a toxic query."""

    async def publish_violation(
        self,
        user_id: UUID,
        violation_type: str,
        severity: str,
        evidence: str,
        source: str,
        user_department_id: Optional[UUID] = None,
        user_role: str = "USER"
    ) -> None:
        """
        Publish a violation event to RabbitMQ.

        Args:
            user_id: The user who sent the blocked query
            violation_type: Type of violation (e.g., TOXIC_QUERY, ABUSE, SPAM, POLICY_BREAK)
            severity: Severity level (LOW, MEDIUM, HIGH)
            evidence: The blocked query content
            source: Source of violation (SYSTEM for auto-detected, ADMIN for manual reports)
            user_department_id: Optional department ID for tracking
            user_role: User's role at time of violation
        """
        event = {
            "event_type": "violation.layer1",
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0",
            "payload": {
                "user_id": str(user_id),
                "violation_type": violation_type,
                "severity": severity,
                "evidence": evidence,
                "source": source,
                "user_department_id": str(user_department_id) if user_department_id else None,
                "user_role": user_role
            }
        }

        try:
            await publisher.publish_json("violation.layer1", event)
            logger.info(
                "violation_published",
                user_id=str(user_id),
                violation_type=violation_type,
                severity=severity
            )
        except Exception as e:
            logger.error("failed_to_publish_violation", error=str(e), user_id=str(user_id))


violation_publisher = ViolationPublisher()
