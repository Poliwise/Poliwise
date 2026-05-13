from typing import List
import re


class QueryRefiner:
    @staticmethod
    def expand_query(query: str) -> str:
        synonyms = {
            "policy": ["guideline", "rule", "regulation", "procedure"],
            "vacation": ["leave", "time off", "holiday"],
            "remote": ["work from home", "WFH", "telecommute"],
            "benefits": ["perks", "compensation", "advantages"],
            "salary": ["wage", "pay", "compensation"],
            "training": ["learning", "development", "course", "workshop"],
            "expense": ["reimbursement", "claim", "cost"],
        }

        query_lower = query.lower()
        expanded = query

        for key, values in synonyms.items():
            if key in query_lower:
                for val in values:
                    if val not in query_lower:
                        expanded += f" OR {val}"

        return expanded

    @staticmethod
    def extract_filters(query: str) -> dict:
        filters = {}
        date_patterns = [
            r"(?:in|during|since|before|after)\s+(\d{4})",
            r"(\d{4})\s*(?:year)?",
        ]
        for pattern in date_patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                filters["year"] = match.group(1)
                break

        return filters

    @staticmethod
    def remove_stopwords(query: str) -> str:
        stopwords = {"the", "a", "an", "is", "are", "was", "were", "be", "been",
                     "have", "has", "had", "do", "does", "did", "will", "would",
                     "could", "should", "may", "might", "must", "can", "of", "at",
                     "to", "for", "with", "on", "in", "at", "by", "from"}
        words = query.lower().split()
        return " ".join([w for w in words if w not in stopwords])


query_refiner = QueryRefiner()