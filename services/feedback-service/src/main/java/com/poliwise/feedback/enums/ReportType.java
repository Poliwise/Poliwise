package com.poliwise.feedback.enums;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Arrays;

public enum ReportType {

    USAGE_SUMMARY("USAGE_SUMMARY"), QUESTION_ANALYTICS("QUESTION_ANALYTICS"), FEEDBACK_ANALYSIS(
            "FEEDBACK_ANALYSIS"), USER_ENGAGEMENT("USER_ENGAGEMENT"), DOCUMENT_POPULARITY(
                    "DOCUMENT_POPULARITY"), UNANSWERED_QUESTIONS(
                            "UNANSWERED_QUESTIONS"), DEPARTMENT_BREAKDOWN("DEPARTMENT_BREAKDOWN");

    private final String value;

    ReportType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static ReportType fromValue(String value) {
        return Arrays.stream(values()).filter(v -> v.value.equalsIgnoreCase(value)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown ReportType: " + value));
    }
}
