package com.poliwise.metadata.service;

import com.poliwise.metadata.dto.CreateCategoryRequest;
import com.poliwise.metadata.dto.UpdateCategoryRequest;
import com.poliwise.metadata.dto.CategoryResponse;
import com.poliwise.metadata.entity.Category;
import com.poliwise.metadata.exception.ResourceNotFoundException;
import com.poliwise.metadata.exception.DuplicateResourceException;
import com.poliwise.metadata.repository.CategoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CategoryService {

    private static final Logger log = LoggerFactory.getLogger(CategoryService.class);

    private final CategoryRepository categoryRepository;

    public CategoryService(CategoryRepository categoryRepository) {
        this.categoryRepository = categoryRepository;
    }

    @Transactional
    public CategoryResponse create(CreateCategoryRequest request) {
        String slug = generateSlug(request.name());

        if (categoryRepository.findBySlug(slug).isPresent()) {
            throw new DuplicateResourceException("Category already exists with name: " + request.name());
        }

        OffsetDateTime now = OffsetDateTime.now();
        Category category = Category.builder()
                .id(UUID.randomUUID())
                .name(request.name())
                .slug(slug)
                .description(request.description())
                .parentId(request.parentId())
                .icon(request.icon())
                .displayOrder(request.displayOrder())
                .isActive(true)
                .createdAt(now)
                .updatedAt(now)
                .build();

        Category saved = categoryRepository.save(category);
        log.info("Created category: id={}, name={}", saved.getId(), saved.getName());
        return toResponse(saved);
    }

    public List<CategoryResponse> getAll() {
        return categoryRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<CategoryResponse> getActive() {
        return categoryRepository.findByIsActiveTrueOrderByDisplayOrderAscNameAsc().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public CategoryResponse getById(UUID id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + id));
        return toResponse(category);
    }

    @Transactional
    public CategoryResponse update(UUID id, UpdateCategoryRequest request) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + id));

        String newSlug = generateSlug(request.name());
        if (!newSlug.equals(category.getSlug())) {
            categoryRepository.findBySlug(newSlug).ifPresent(existing -> {
                throw new DuplicateResourceException("Category already exists with name: " + request.name());
            });
        }

        category.setName(request.name());
        category.setSlug(newSlug);
        category.setDescription(request.description());
        category.setParentId(request.parentId());
        category.setIcon(request.icon());
        category.setDisplayOrder(request.displayOrder());
        category.setUpdatedAt(OffsetDateTime.now());

        Category saved = categoryRepository.save(category);
        log.info("Updated category: id={}", id);
        return toResponse(saved);
    }

    @Transactional
    public void delete(UUID id) {
        Category category = categoryRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Category not found: " + id));

        category.setIsActive(false);
        category.setUpdatedAt(OffsetDateTime.now());
        categoryRepository.save(category);

        log.info("Deactivated category: id={}", id);
    }

    private String generateSlug(String name) {
        if (name == null) return "";
        return name.trim().toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
    }

    private CategoryResponse toResponse(Category category) {
        return new CategoryResponse(
                category.getId(),
                category.getName(),
                category.getSlug(),
                category.getDescription(),
                category.getParentId(),
                category.getIcon(),
                category.getDisplayOrder(),
                category.getIsActive(),
                category.getCreatedAt(),
                category.getUpdatedAt()
        );
    }
}