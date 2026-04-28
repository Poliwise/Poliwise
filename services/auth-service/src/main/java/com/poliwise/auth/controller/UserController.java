package com.poliwise.auth.controller;

import com.poliwise.auth.dto.auth.*;
import com.poliwise.auth.security.JwtAuthenticationToken;
import com.poliwise.auth.service.UserManagementService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
@PreAuthorize("hasRole('ADMIN')")
public class UserController {

    private final UserManagementService userManagementService;

    public UserController(UserManagementService userManagementService) {
        this.userManagementService = userManagementService;
    }

    @PostMapping
    public ResponseEntity<?> createUser(
            @Valid @RequestBody UserCreateRequest request,
            @AuthenticationPrincipal JwtAuthenticationToken authToken,
            HttpServletRequest httpRequest
    ) {
        UUID createdBy = authToken != null ? authToken.getPayload().sub() : null;
        AuthUserView user = userManagementService.createUser(request, createdBy);
        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }

    @PostMapping("/bulk")
    public ResponseEntity<?> createBulkUsers(
            @Valid @RequestBody BulkUserCreateRequest request,
            @AuthenticationPrincipal JwtAuthenticationToken authToken
    ) {
        UUID createdBy = authToken != null ? authToken.getPayload().sub() : null;
        BulkUserCreateResponse result = userManagementService.createBulkUsers(request, createdBy);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @GetMapping
    public ResponseEntity<?> searchUsers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID departmentId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int limit
    ) {
        Pageable pageable = PageRequest.of(page, Math.min(limit, 100));
        Page<UserBasicView> users = userManagementService.searchUsers(search, role, status, departmentId, pageable);
        return ResponseEntity.ok(Map.of(
                "data", users.getContent(),
                "pagination", Map.of(
                        "page", users.getNumber(),
                        "limit", users.getSize(),
                        "total", users.getTotalElements(),
                        "totalPages", users.getTotalPages()
                )
        ));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<?> getUser(@PathVariable UUID userId) {
        UserDetailView user = userManagementService.getUserById(userId);
        return ResponseEntity.ok(user);
    }

    @PutMapping("/{userId}")
    public ResponseEntity<?> updateUser(
            @PathVariable UUID userId,
            @Valid @RequestBody UserUpdateRequest request,
            @AuthenticationPrincipal JwtAuthenticationToken authToken
    ) {
        UUID updatedBy = authToken != null ? authToken.getPayload().sub() : null;
        UserDetailView user = userManagementService.updateUser(userId, request, updatedBy);
        return ResponseEntity.ok(user);
    }

    @PostMapping("/{userId}/deactivate")
    public ResponseEntity<?> deactivateUser(@PathVariable UUID userId) {
        userManagementService.deactivateUser(userId);
        return ResponseEntity.ok(MessageResponse.ok("User deactivated successfully"));
    }

    @PostMapping("/{userId}/reactivate")
    public ResponseEntity<?> reactivateUser(@PathVariable UUID userId) {
        userManagementService.reactivateUser(userId);
        return ResponseEntity.ok(MessageResponse.ok("User reactivated successfully"));
    }

    @PostMapping("/{userId}/revoke")
    public ResponseEntity<?> revokeUser(@PathVariable UUID userId) {
        userManagementService.revokeUser(userId);
        return ResponseEntity.ok(MessageResponse.ok("User revoked successfully"));
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<?> deleteUser(@PathVariable UUID userId) {
        userManagementService.deleteUser(userId);
        return ResponseEntity.ok(MessageResponse.ok("User deleted successfully"));
    }

    @GetMapping("/{userId}/login-history")
    public ResponseEntity<?> getLoginHistory(
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int limit
    ) {
        Pageable pageable = PageRequest.of(page, Math.min(limit, 100));
        Page<LoginHistoryInfo> history = userManagementService.getLoginHistory(userId, pageable);
        return ResponseEntity.ok(Map.of(
                "data", history.getContent(),
                "pagination", Map.of(
                        "page", history.getNumber(),
                        "limit", history.getSize(),
                        "total", history.getTotalElements(),
                        "totalPages", history.getTotalPages()
                )
        ));
    }
}
