from enum import Enum
from typing import Optional


class Intent(str, Enum):
    RAG = "rag"
    CHITCHAT = "chitchat"
    IRRELEVANT = "irrelevant"
    REJECT = "reject"


class SafetyLevel(str, Enum):
    SAFE = "safe"
    TOXIC = "toxic"
    UNSURE = "unsure"


class IntentClassifier:
    CHITCHAT_KEYWORDS = [
        "hello", "hi", "hey", "thanks", "thank you", "goodbye", "bye",
        "how are you", "how's it going", "nice to meet you"
    ]

    REJECT_KEYWORDS = [
        "hack", "exploit", "bypass", "ignore", "forget", "system prompt",
        "ignore previous", "disregard", "jailbreak"
    ]

    def classify(self, query: str) -> tuple[Intent, SafetyLevel]:
        query_lower = query.lower().strip()

        for keyword in self.REJECT_KEYWORDS:
            if keyword in query_lower:
                return Intent.REJECT, SafetyLevel.TOXIC

        for keyword in self.CHITCHAT_KEYWORDS:
            if keyword in query_lower:
                return Intent.CHITCHAT, SafetyLevel.SAFE

        return Intent.RAG, SafetyLevel.SAFE

    def is_safe(self, query: str) -> tuple[bool, Optional[str]]:
        intent, safety = self.classify(query)
        if safety == SafetyLevel.TOXIC:
            return False, "Content violates safety guidelines"
        if intent == Intent.REJECT:
            return False, "Query rejected by safety filter"
        return True, None


intent_classifier = IntentClassifier()