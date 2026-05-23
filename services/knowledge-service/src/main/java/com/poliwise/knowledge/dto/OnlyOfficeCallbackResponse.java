package com.poliwise.knowledge.dto;

import java.util.UUID;

/**
 * Response returned by OnlyOffice save callback.
 * OnlyOffice expects a JSON response confirming save status.
 * The "status" field tells OnlyOffice what to do next:
 *   "editing" (or {error:0,status:1}) — keep the editor open, user continues editing
 *   "save"    (or {error:0,status:2}) — download the file and POST it to the callback URL
 */
public record OnlyOfficeCallbackResponse(
    int error,
    String message,
    Integer createdVersion,
    String documentId,
    String status
) {
    public static OnlyOfficeCallbackResponse forEditing(UUID documentId) {
        return new OnlyOfficeCallbackResponse(0, "Document is open for editing", null, documentId.toString(), "editing");
    }

    public static OnlyOfficeCallbackResponse success(int createdVersion, UUID documentId) {
        return new OnlyOfficeCallbackResponse(0, "Saved", createdVersion, documentId.toString(), null);
    }

    public static OnlyOfficeCallbackResponse conflict(String message, UUID documentId) {
        return new OnlyOfficeCallbackResponse(1, message, 0, documentId.toString(), null);
    }

    public static OnlyOfficeCallbackResponse error(String message, UUID documentId) {
        return new OnlyOfficeCallbackResponse(1, message, 0, documentId.toString(), null);
    }
}
