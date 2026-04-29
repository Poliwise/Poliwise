package com.poliwise.user.dto;

import java.util.UUID;

/**
 * DTO gán/phân công phòng ban cho người dùng.
 */
public record AssignUserDepartmentRequest(
        UUID userId,
        UUID departmentId
) {}
