package com.poliwise.user.controller;

import com.poliwise.user.dto.*;
import com.poliwise.user.service.DepartmentService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * REST Controller cho quản lý Phòng ban.
 */
@RestController
@RequestMapping("/api/v1/departments")
@PreAuthorize("hasRole('ADMIN')")
public class DepartmentController {

    private final DepartmentService departmentService;

    public DepartmentController(DepartmentService departmentService) {
        this.departmentService = departmentService;
    }

    // ==================== CRUD ====================

    /**
     * Tạo mới phòng ban.
     * POST /api/v1/departments
     */
    @PostMapping
    public ResponseEntity<DepartmentResponse> createDepartment(
            @Valid @RequestBody CreateDepartmentRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(departmentService.createDepartment(request));
    }

    /**
     * Cập nhật phòng ban.
     * PUT /api/v1/departments/{departmentId}
     */
    @PutMapping("/{departmentId}")
    public ResponseEntity<DepartmentResponse> updateDepartment(
            @PathVariable UUID departmentId,
            @Valid @RequestBody UpdateDepartmentRequest request) {
        return ResponseEntity.ok(departmentService.updateDepartment(departmentId, request));
    }

    /**
     * Lấy thông tin phòng ban theo ID.
     * GET /api/v1/departments/{departmentId}
     */
    @GetMapping("/{departmentId}")
    public ResponseEntity<DepartmentResponse> getDepartmentById(@PathVariable UUID departmentId) {
        return ResponseEntity.ok(departmentService.getDepartmentById(departmentId));
    }

    /**
     * Lấy danh sách tất cả phòng ban (phân trang).
     * GET /api/v1/departments
     */
    @GetMapping
    public ResponseEntity<PageResponse<DepartmentResponse>> getAllDepartments(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "ASC") String sortDir) {
        return ResponseEntity.ok(departmentService.getAllDepartments(page, size, sortBy, sortDir));
    }

    /**
     * Lấy danh sách phòng ban đang hoạt động.
     * GET /api/v1/departments/active
     */
    @GetMapping("/active")
    public ResponseEntity<List<DepartmentResponse>> getActiveDepartments() {
        return ResponseEntity.ok(departmentService.getActiveDepartments());
    }

    /**
     * Lấy cây phòng ban (hierarchical view).
     * GET /api/v1/departments/tree
     */
    @GetMapping("/tree")
    public ResponseEntity<List<DepartmentResponse.DepartmentTreeInfo>> getDepartmentTree() {
        return ResponseEntity.ok(departmentService.getDepartmentTree());
    }

    /**
     * Xóa phòng ban (soft delete).
     * DELETE /api/v1/departments/{departmentId}
     */
    @DeleteMapping("/{departmentId}")
    public ResponseEntity<Map<String, String>> deleteDepartment(@PathVariable UUID departmentId) {
        departmentService.deleteDepartment(departmentId);
        return ResponseEntity.ok(Map.of(
                "message", "Department deleted successfully",
                "departmentId", departmentId.toString()
        ));
    }

    // ==================== User-Department Assignment ====================

    /**
     * Gán người dùng vào phòng ban.
     * POST /api/v1/departments/assign-user
     */
    @PostMapping("/assign-user")
    public ResponseEntity<UserResponse> assignUserToDepartment(
            @Valid @RequestBody AssignUserDepartmentRequest request) {
        return ResponseEntity.ok(departmentService.assignUserToDepartment(
                request.userId(), request.departmentId()));
    }

    /**
     * Lấy danh sách người dùng trong phòng ban.
     * GET /api/v1/departments/{departmentId}/users
     */
    @GetMapping("/{departmentId}/users")
    public ResponseEntity<PageResponse<UserResponse>> getUsersByDepartment(
            @PathVariable UUID departmentId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(departmentService.getUsersByDepartment(departmentId, page, size));
    }
}
