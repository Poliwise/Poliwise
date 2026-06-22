package com.poliwise.knowledge.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "document_locks", schema = "knowledge")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DocumentLock {

    @Id
    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "locked_by", nullable = false)
    private UUID lockedBy;

    @Column(name = "locked_at", nullable = false)
    private OffsetDateTime lockedAt;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "lock_token", nullable = false, unique = true)
    private UUID lockToken;

    @Column(name = "version_at_lock", nullable = false)
    private Integer versionAtLock;

    @Column(name = "locked_by_username")
    private String lockedByUsername;

    public boolean isExpired() {
        return OffsetDateTime.now().isAfter(expiresAt);
    }

    public boolean matchesToken(UUID token) {
        return lockToken != null && lockToken.equals(token);
    }

    public boolean isOwnedBy(UUID userId) {
        return lockedBy != null && lockedBy.equals(userId);
    }
}
