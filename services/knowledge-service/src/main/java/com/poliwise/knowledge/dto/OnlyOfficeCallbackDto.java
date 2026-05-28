package com.poliwise.knowledge.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * DTO for OnlyOffice Document Server save callback.
 * OnlyOffice sends a JSON body (Content-Type: application/json) with:
 *   - status=1 (editing): user is still editing, no file
 *   - status=2 (mustSave): document was saved, contains url to the cached file
 */
@Data
public class OnlyOfficeCallbackDto {
    private String key;
    private Integer status;
    private String url;
    private String changesurl;
    private History history;
    private String[] users;
    private Action[] actions;
    private String lastsave;
    private Boolean notmodified;
    private String filetype;
    private String userdata;

    @JsonProperty("history")
    private History getHistory() { return history; }

    @Data
    public static class History {
        private String serverVersion;
        private Change[] changes;
    }

    @Data
    public static class Change {
        private String created;
        private User user;
    }

    @Data
    public static class User {
        private String id;
        private String name;
    }

    @Data
    public static class Action {
        private Integer type;
        private String userid;
    }
}
