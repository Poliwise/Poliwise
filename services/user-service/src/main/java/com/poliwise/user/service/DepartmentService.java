package com.poliwise.user.service;

import com.poliwise.user.dto.*;
import com.poliwise.user.entity.Department;
import com.poliwise.user.entity.User;
import com.poliwise.user.exception.DepartmentNotFoundException;
import com.poliwise.user.exception.InvalidDepartmentOperationException;
import com.poliwise.user.repository.DepartmentRepository;
import com.poliwise.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Service quản lý phòng ban (Department CRUD).
 */
@Service
public class DepartmentService {

    private static final Logger log = LoggerFactory.getLogger(DepartmentService.class);

    private final DepartmentRepository departmentRepository;
    private final UserRepository userRepository;

    public DepartmentService(DepartmentRepository departmentRepository, UserRepository userRepository) {
        this.departmentRepository = departmentRepository;
        this.userRepository = userRepository;
    }

    // ==================== CRUD Operations ====================

    /**
     * Tạo mới phòng ban.
     */
    @Transactional
    public DepartmentResponse createDepartment(CreateDepartmentRequest request) {
        // Check unique code
        if (departmentRepository.existsByCodeIgnoreCase(request.code())) {
            throw new InvalidDepartmentOperationException("Mã phòng ban đã tồn tại: " + request.code());
        }

        Department department = new Department();
        department.setId(UUID.randomUUID());
        department.setName(request.name());
        department.setCode(request.code().toUpperCase());
        department.setDescription(request.description());
        department.setIsActive(true);
        department.setCreatedAt(OffsetDateTime.now());
        department.setUpdatedAt(OffsetDateTime.now());

        // Set parent if provided
        if (request.parentId() != null) {
            Department parent = departmentRepository.findById(request.parentId())
                    .orElseThrow(() -> new DepartmentNotFoundException(
                            "Phòng ban cha không tồn tại: " + request.parentId()));
            department.setParent(parent);
        }

        Department saved = departmentRepository.save(department);
        log.info("Created department: id={}, name={}, code={}", saved.getId(), saved.getName(), saved.getCode());
        return toResponse(saved, 0);
    }

    /**
     * Cập nhật phòng ban.
     */
    @Transactional
    public DepartmentResponse updateDepartment(UUID departmentId, UpdateDepartmentRequest request) {
        Department department = departmentRepository.findByIdForUpdate(departmentId)
                .orElseThrow(() -> new DepartmentNotFoundException("Phòng ban không tồn tại: " + departmentId));

        if (request.name() != null && !request.name().isBlank()) {
            department.setName(request.name());
        }

        if (request.description() != null) {
            department.setDescription(request.description());
        }

        if (request.isActive() != null) {
            department.setIsActive(request.isActive());
        }

        if (request.parentId() != null) {
            // Prevent self-reference
            if (request.parentId().equals(departmentId)) {
                throw new InvalidDepartmentOperationException("Phòng ban không thể là cha của chính nó");
            }
            Department parent = departmentRepository.findById(request.parentId())
                    .orElseThrow(() -> new DepartmentNotFoundException(
                            "Phòng ban cha không tồn tại: " + request.parentId()));
            department.setParent(parent);
        }

        department.setUpdatedAt(OffsetDateTime.now());
        Department saved = departmentRepository.save(department);
        log.info("Updated department: id={}, name={}", saved.getId(), saved.getName());
        return toResponse(saved, getUserCount(departmentId));
    }

    /**
     * Lấy thông tin phòng ban theo ID.
     */
    @Transactional(readOnly = true)
    public DepartmentResponse getDepartmentById(UUID departmentId) {
        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new DepartmentNotFoundException("Phòng ban không tồn tại: " + departmentId));
        return toResponse(department, getUserCount(departmentId));
    }

    /**
     * Lấy danh sách tất cả phòng ban (phân trang).
     */
    @Transactional(readOnly = true)
    public PageResponse<DepartmentResponse> getAllDepartments(int page, int size, String sortBy, String sortDir) {
        var pageable = org.springframework.data.domain.PageRequest.of(
                page, size,
                org.springframework.data.domain.Sort.by(
                        org.springframework.data.domain.Sort.Direction.fromString(sortDir != null ? sortDir : "ASC"),
                        sortBy != null ? sortBy : "name"
                )
        );
        var result = departmentRepository.findAll(pageable);
        var content = result.getContent().stream()
                .map(d -> toResponse(d, getUserCount(d.getId())))
                .toList();

        return new PageResponse<>(
                content,
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.isFirst(),
                result.isLast()
        );
    }

    /**
     * Lấy danh sách phòng ban đang hoạt động.
     */
    @Transactional(readOnly = true)
    public List<DepartmentResponse> getActiveDepartments() {
        return departmentRepository.findByIsActiveTrueOrderByNameAsc().stream()
                .map(d -> toResponse(d, getUserCount(d.getId())))
                .toList();
    }

    /**
     * Lấy cây phòng ban (hierarchical view).
     */
    @Transactional(readOnly = true)
    public List<DepartmentResponse.DepartmentTreeInfo> getDepartmentTree() {
        var rootDepartments = departmentRepository.findByParentIsNullAndIsActiveTrueOrderByNameAsc();
        return rootDepartments.stream()
                .map(this::buildTreeNode)
                .toList();
    }

    /**
     * Xóa phòng ban (soft delete - chỉ deactivate).
     */
    @Transactional
    public void deleteDepartment(UUID departmentId) {
        Department department = departmentRepository.findByIdForUpdate(departmentId)
                .orElseThrow(() -> new DepartmentNotFoundException("Phòng ban không tồn tại: " + departmentId));

        // Check if department has users
        long userCount = userRepository.countByDepartmentId(departmentId);
        if (userCount > 0) {
            throw new InvalidDepartmentOperationException(
                    "Không thể xóa phòng ban đang có " + userCount + " người dùng. Vui lòng chuyển người dùng sang phòng ban khác trước.");
        }

        department.setIsActive(false);
        department.setUpdatedAt(OffsetDateTime.now());
        departmentRepository.save(department);
        log.info("Deactivated department: id={}, name={}", department.getId(), department.getName());
    }

    // ==================== User-Department Assignment ====================

    /**
     * Gán người dùng vào phòng ban (Admin).
     */
    @Transactional
    public UserResponse assignUserToDepartment(UUID userId, UUID departmentId) {
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> new com.poliwise.user.exception.UserNotFoundException(
                        "Người dùng không tồn tại: " + userId));

        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new DepartmentNotFoundException(
                        "Phòng ban không tồn tại: " + departmentId));

        if (!Boolean.TRUE.equals(department.getIsActive())) {
            throw new InvalidDepartmentOperationException(
                    "Không thể gán người dùng vào phòng ban không hoạt động: " + department.getName());
        }

        user.setDepartment(department);
        User saved = userRepository.save(user);
        log.info("Assigned user {} to department {} ({})", userId, departmentId, department.getName());
        return toUserResponse(saved);
    }

    /**
     * Lấy danh sách người dùng trong một phòng ban.
     */
    @Transactional(readOnly = true)
    public PageResponse<UserResponse> getUsersByDepartment(UUID departmentId, int page, int size) {
        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new DepartmentNotFoundException("Phòng ban không tồn tại: " + departmentId));

        var pageable = org.springframework.data.domain.PageRequest.of(page, size);
        var result = userRepository.findByDepartmentId(departmentId, pageable);
        var content = result.getContent().stream()
                .map(this::toUserResponse)
                .toList();

        return new PageResponse<>(
                content,
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.isFirst(),
                result.isLast()
        );
    }

    // ==================== Helper Methods ====================

    private DepartmentResponse toResponse(Department department, int userCount) {
        DepartmentResponse.ParentDepartmentInfo parentInfo = null;
        if (department.getParent() != null) {
            parentInfo = new DepartmentResponse.ParentDepartmentInfo(
                    department.getParent().getId(),
                    department.getParent().getName(),
                    department.getParent().getCode()
            );
        }

        return new DepartmentResponse(
                department.getId(),
                department.getName(),
                department.getCode(),
                department.getDescription(),
                parentInfo,
                department.getIsActive(),
                userCount,
                department.getCreatedAt(),
                department.getUpdatedAt()
        );
    }

    private UserResponse toUserResponse(User user) {
        com.poliwise.user.entity.UserProfile profile = user.getProfile();
        com.poliwise.user.dto.UserResponse.DepartmentInfo deptInfo = null;
        if (user.getDepartment() != null) {
            deptInfo = new com.poliwise.user.dto.UserResponse.DepartmentInfo(
                    user.getDepartment().getId(),
                    user.getDepartment().getName(),
                    user.getDepartment().getCode()
            );
        }

        com.poliwise.user.dto.UserResponse.UserProfileInfo profileInfo = null;
        if (profile != null) {
            profileInfo = new com.poliwise.user.dto.UserResponse.UserProfileInfo(
                    profile.getId(),
                    profile.getFullName(),
                    profile.getPhone(),
                    profile.getPosition(),
                    profile.getAvatarUrl(),
                    profile.getBio(),
                    profile.getDateOfBirth(),
                    profile.getEmployeeCode(),
                    profile.getJoinedDate()
            );
        }

        return new com.poliwise.user.dto.UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole(),
                user.getStatus(),
                user.getDepartment() != null ? user.getDepartment().getId() : null,
                deptInfo,
                profileInfo,
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }

    private int getUserCount(UUID departmentId) {
        return (int) userRepository.countByDepartmentId(departmentId);
    }

    private DepartmentResponse.DepartmentTreeInfo buildTreeNode(Department department) {
        List<DepartmentResponse.DepartmentTreeInfo> children = new ArrayList<>();
        if (department.getSubDepartments() != null && !department.getSubDepartments().isEmpty()) {
            children = department.getSubDepartments().stream()
                    .filter(Department::getIsActive)
                    .map(this::buildTreeNode)
                    .toList();
        }
        return new DepartmentResponse.DepartmentTreeInfo(
                department.getId(),
                department.getName(),
                department.getCode(),
                department.getIsActive(),
                children
        );
    }
}
