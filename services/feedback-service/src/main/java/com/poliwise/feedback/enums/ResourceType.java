package com.poliwise.feedback.enums;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Arrays;

public enum ResourceType {

    USER("USER"), DOCUMENT("DOCUMENT"), CONVERSATION("CONVERSATION"), MESSAGE("MESSAGE"), FEEDBACK(
            "FEEDBACK"), DEPARTMENT(
                    "DEPARTMENT"), CATEGORY("CATEGORY"), TAG("TAG"), SETTINGS("SETTINGS");

    private final String value;

    ResourceType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static ResourceType fromValue(String value) {
        return Arrays.stream(values()).filter(v -> v.value.equalsIgnoreCase(value)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unknown ResourceType: " + value));
    }
}
