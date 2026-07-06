package com.poliwise.feedback.service;

import com.poliwise.feedback.entity.Warning;
import com.poliwise.feedback.repository.WarningRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class WarningService {

    private final WarningRepository warningRepository;

    public Page<Warning> getUnreadWarnings(UUID userId, Pageable pageable) {
        return warningRepository.findByUserIdAndReadAtIsNull(userId, pageable);
    }

    public List<Warning> getActiveWarnings(UUID userId) {
        return warningRepository.findByUserIdAndReadAtIsNullAndExpiresAtAfter(
                userId, Instant.now());
    }

    public long countUnreadWarnings(UUID userId) {
        return warningRepository.countUnreadByUserId(userId);
    }

    public long countTotalWarnings() {
        return warningRepository.count();
    }

    @Transactional
    public Warning acknowledgeWarning(UUID warningId, UUID userId) {
        Warning warning = warningRepository.findById(warningId)
                .orElseThrow(() -> new IllegalArgumentException("Warning not found: " + warningId));

        // Users can only acknowledge their own warnings
        if (!warning.getUserId().equals(userId)) {
            throw new IllegalArgumentException("Cannot acknowledge another user's warning");
        }

        if (warning.getReadAt() != null) {
            throw new IllegalArgumentException("Warning already acknowledged");
        }

        warning.setReadAt(Instant.now());
        log.info("Warning {} acknowledged by user {}", warningId, userId);
        return warningRepository.save(warning);
    }
}
