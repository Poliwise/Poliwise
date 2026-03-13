package com.poliwise.feedback.enums;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Arrays;

public enum FeedbackType {

    LIKE("LIKE"), DISLIKE("DISLIKE");

    private final String value;

    FeedbackType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static FeedbackType fromValue(String value) {
        return Arrays.stream(values()).filter(v -> v.value.equalsIgnoreCase(value)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown FeedbackType: " + value));
    }
}
