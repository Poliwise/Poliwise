package com.poliwise.user.service;

import com.poliwise.user.entity.User;
import com.poliwise.user.enums.AccountStatus;
import com.poliwise.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class StrikeCountService {

    private final UserRepository userRepository;

    @Transactional
    public void incrementStrikeCount(String userIdStr) {
        User user = userRepository.findById(java.util.UUID.fromString(userIdStr))
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userIdStr));
        
        int currentCount = user.getStrikeCount() != null ? user.getStrikeCount() : 0;
        user.setStrikeCount(currentCount + 1);
        user.setLastViolationAt(OffsetDateTime.now());
        userRepository.save(user);
        
        log.info("Incremented strike count for user {}: {} -> {}", 
                userIdStr, currentCount, currentCount + 1);
    }

    @Transactional
    public void decrementStrikeCount(String userIdStr) {
        decrementStrikeCount(userIdStr, 1);
    }

    @Transactional
    public void decrementStrikeCount(String userIdStr, int count) {
        User user = userRepository.findById(java.util.UUID.fromString(userIdStr))
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userIdStr));
        
        int currentCount = user.getStrikeCount() != null ? user.getStrikeCount() : 0;
        int newCount = Math.max(0, currentCount - count);
        user.setStrikeCount(newCount);
        userRepository.save(user);
        
        log.info("Decremented strike count for user {}: {} -> {}", 
                userIdStr, currentCount, newCount);
    }

    @Transactional
    public void resetStrikeCount(String userIdStr) {
        User user = userRepository.findById(java.util.UUID.fromString(userIdStr))
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userIdStr));
        
        user.setStrikeCount(0);
        user.setLastViolationAt(null);
        userRepository.save(user);
        
        log.info("Reset strike count for user {}", userIdStr);
    }

    public int getStrikeCount(String userIdStr) {
        User user = userRepository.findById(java.util.UUID.fromString(userIdStr))
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userIdStr));
        
        return user.getStrikeCount() != null ? user.getStrikeCount() : 0;
    }

    @Transactional
    public void changeUserStatus(String userIdStr, String statusStr) {
        User user = userRepository.findById(java.util.UUID.fromString(userIdStr))
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + userIdStr));
        
        AccountStatus newStatus;
        try {
            newStatus = AccountStatus.valueOf(statusStr);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid status: " + statusStr);
        }
        
        AccountStatus currentStatus = user.getStatus();
        user.setStatus(newStatus);
        
        // Set timestamps for status changes
        if (newStatus == AccountStatus.DEACTIVATED && currentStatus != AccountStatus.DEACTIVATED) {
            user.setDeactivatedAt(java.time.OffsetDateTime.now());
        } else if (newStatus == AccountStatus.REVOKED && currentStatus != AccountStatus.REVOKED) {
            user.setRevokedAt(java.time.OffsetDateTime.now());
        } else if (newStatus == AccountStatus.ACTIVE && currentStatus == AccountStatus.DEACTIVATED) {
            user.setDeactivatedAt(null);
        }
        
        userRepository.save(user);
        
        log.info("Changed user {} status from {} to {}", userIdStr, currentStatus, newStatus);
    }
}
