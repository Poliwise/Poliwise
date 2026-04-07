package com.poliwise.metadata.service;

import com.poliwise.metadata.dto.CreateTagRequest;
import com.poliwise.metadata.dto.UpdateTagRequest;
import com.poliwise.metadata.dto.TagResponse;
import com.poliwise.metadata.entity.Tag;
import com.poliwise.metadata.exception.ResourceNotFoundException;
import com.poliwise.metadata.exception.DuplicateResourceException;
import com.poliwise.metadata.repository.TagRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class TagService {

    private static final Logger log = LoggerFactory.getLogger(TagService.class);

    private final TagRepository tagRepository;

    public TagService(TagRepository tagRepository) {
        this.tagRepository = tagRepository;
    }

    @Transactional
    public TagResponse create(CreateTagRequest request) {
        String slug = generateSlug(request.name());

        if (tagRepository.findBySlug(slug).isPresent()) {
            throw new DuplicateResourceException("Tag already exists with name: " + request.name());
        }

        Tag tag = Tag.builder()
                .id(UUID.randomUUID())
                .name(request.name())
                .slug(slug)
                .color(request.color() != null ? request.color() : "#6366f1")
                .usageCount(0)
                .createdAt(OffsetDateTime.now())
                .build();

        Tag saved = tagRepository.save(tag);
        log.info("Created tag: id={}, name={}", saved.getId(), saved.getName());
        return toResponse(saved);
    }

    public List<TagResponse> getAll() {
        return tagRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<TagResponse> getPopular() {
        return tagRepository.findTopByOrderByUsageCountDesc().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public TagResponse getById(UUID id) {
        Tag tag = tagRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tag not found: " + id));
        return toResponse(tag);
    }

    @Transactional
    public TagResponse update(UUID id, UpdateTagRequest request) {
        Tag tag = tagRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tag not found: " + id));

        if (request.name() != null && !request.name().equals(tag.getName())) {
            String newSlug = generateSlug(request.name());
            tagRepository.findBySlug(newSlug).ifPresent(existing -> {
                throw new DuplicateResourceException("Tag already exists with name: " + request.name());
            });
            tag.setName(request.name());
            tag.setSlug(newSlug);
        }

        if (request.color() != null) {
            tag.setColor(request.color());
        }

        Tag saved = tagRepository.save(tag);
        log.info("Updated tag: id={}", id);
        return toResponse(saved);
    }

    @Transactional
    public void delete(UUID id) {
        Tag tag = tagRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Tag not found: " + id));

        tagRepository.delete(tag);
        log.info("Deleted tag: id={}", id);
    }

    private String generateSlug(String name) {
        if (name == null) return "";
        return name.trim().toLowerCase()
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-")
                .replaceAll("^-|-$", "");
    }

    private TagResponse toResponse(Tag tag) {
        return new TagResponse(
                tag.getId(),
                tag.getName(),
                tag.getSlug(),
                tag.getColor(),
                tag.getUsageCount(),
                tag.getCreatedAt()
        );
    }
}