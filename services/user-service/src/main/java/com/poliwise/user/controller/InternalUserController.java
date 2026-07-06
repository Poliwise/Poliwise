package com.poliwise.user.controller;

import com.poliwise.user.service.StrikeCountService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * Internal controller for strike count management.
 * These endpoints are called by feedback-service for violation escalation.
 * They should be protected at the network level (internal network only).
 */
@RestController
@RequestMapping("/api/v1/internal/users")
public class InternalUserController {

    private final StrikeCountService strikeCountService;

    public InternalUserController(StrikeCountService strikeCountService) {
        this.strikeCountService = strikeCountService;
    }

    @PostMapping("/{userId}/strikes/increment")
    public ResponseEntity<Map<String, String>> incrementStrikeCount(@PathVariable String userId) {
        strikeCountService.incrementStrikeCount(userId);
        return ResponseEntity.ok(Map.of("status", "ok", "message", "Strike count incremented"));
    }

    @PostMapping("/{userId}/strikes/decrement")
    public ResponseEntity<Map<String, String>> decrementStrikeCount(
            @PathVariable String userId,
            @RequestParam(defaultValue = "1") int count) {
        strikeCountService.decrementStrikeCount(userId, count);
        return ResponseEntity.ok(Map.of("status", "ok", "message", "Strike count decremented"));
    }

    @PostMapping("/{userId}/strikes/reset")
    public ResponseEntity<Map<String, String>> resetStrikeCount(@PathVariable String userId) {
        strikeCountService.resetStrikeCount(userId);
        return ResponseEntity.ok(Map.of("status", "ok", "message", "Strike count reset"));
    }

    @GetMapping("/{userId}/strikes")
    public ResponseEntity<Map<String, Object>> getStrikeCount(@PathVariable String userId) {
        int count = strikeCountService.getStrikeCount(userId);
        return ResponseEntity.ok(Map.of("userId", userId, "strikeCount", count));
    }

    @PostMapping("/{userId}/status")
    public ResponseEntity<Map<String, String>> changeUserStatus(
            @PathVariable String userId,
            @RequestParam String status) {
        strikeCountService.changeUserStatus(userId, status);
        return ResponseEntity.ok(Map.of("status", "ok", "message", "User status changed to " + status));
    }
}
