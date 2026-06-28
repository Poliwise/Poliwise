package com.poliwise.knowledge.client;

import com.poliwise.knowledge.dto.ConfirmResultResponse;
import com.poliwise.knowledge.dto.DocumentDuplicateInfo;
import com.poliwise.knowledge.dto.DuplicateCheckResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@Component
public class IngestionServiceClient {

    private static final Logger log = LoggerFactory.getLogger(IngestionServiceClient.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final WebClient ingestionWebClient;

    public IngestionServiceClient(@Value("${knowledge.ingestion.api-url}") String ingestionApiUrl) {
        this.ingestionWebClient = WebClient.builder()
                .baseUrl(ingestionApiUrl)
                .build();
    }

    /**
     * Check for duplicates using file checksum via ingestion-service.
     * Returns a DuplicateCheckResponse with duplicate info if found.
     */
    @SuppressWarnings("unchecked")
    public DuplicateCheckResponse checkDuplicateByChecksum(String checksum) {
        try {
            Map<String, Object> response = ingestionWebClient.get()
                    .uri("/api/v1/check-duplicate?checksum={checksum}", checksum)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(TIMEOUT)
                    .block();

            if (response == null) {
                return DuplicateCheckResponse.notDuplicate();
            }

            boolean isDuplicate = Boolean.TRUE.equals(response.get("isDuplicate"));
            if (!isDuplicate) {
                return DuplicateCheckResponse.notDuplicate();
            }

            String action = (String) response.get("action");
            String detectionMethod = (String) response.get("detectionMethod");
            Double similarity = response.get("similarity") instanceof Number
                    ? ((Number) response.get("similarity")).doubleValue()
                    : null;

            DocumentDuplicateInfo existingDoc = null;
            if (response.get("existingDocument") instanceof Map) {
                Map<String, Object> docMap = (Map<String, Object>) response.get("existingDocument");
                existingDoc = new DocumentDuplicateInfo(
                        docMap.get("documentId") != null ? UUID.fromString(docMap.get("documentId").toString()) : null,
                        (String) docMap.get("originalFilename"),
                        docMap.get("fileSizeBytes") != null ? ((Number) docMap.get("fileSizeBytes")).longValue() : null,
                        null,
                        (String) docMap.get("title"),
                        (String) docMap.get("categorySlug"),
                        (String) docMap.get("status"),
                        (String) docMap.get("fileChecksum")
                );
            }

            DuplicateCheckResponse.BlockAction blockAction = "BLOCK".equals(action)
                    ? DuplicateCheckResponse.BlockAction.BLOCK
                    : DuplicateCheckResponse.BlockAction.SUGGEST_VERSION;

            return new DuplicateCheckResponse(true, blockAction.name(), existingDoc, similarity, detectionMethod);
        } catch (Exception e) {
            log.warn("Failed to check duplicate via ingestion-service: {}", e.getMessage());
            return DuplicateCheckResponse.notDuplicate();
        }
    }

    /**
     * Get job status from ingestion-service for sync polling.
     */
    @SuppressWarnings("unchecked")
    public SyncJobStatus getJobStatus(UUID jobId) {
        try {
            Map<String, Object> response = ingestionWebClient.get()
                    .uri("/api/v1/jobs/{jobId}", jobId)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(TIMEOUT)
                    .block();

            if (response == null) {
                return new SyncJobStatus("UNKNOWN", null, "No response from ingestion-service");
            }

            String status = (String) response.get("status");
            Map<String, Object> metrics = response.get("outputMetrics") instanceof Map
                    ? (Map<String, Object>) response.get("outputMetrics")
                    : null;
            String errorMessage = (String) response.get("errorMessage");

            return new SyncJobStatus(status, metrics, errorMessage);
        } catch (Exception e) {
            log.warn("Failed to get job status for {}: {}", jobId, e.getMessage());
            return new SyncJobStatus("UNKNOWN", null, e.getMessage());
        }
    }

    public record SyncJobStatus(String status, Map<String, Object> outputMetrics, String errorMessage) {
        public boolean isCompleted() {
            return "COMPLETED".equals(status);
        }

        public boolean isFailed() {
            return "FAILED".equals(status);
        }

        public boolean isSkipped() {
            if (outputMetrics == null) return false;
            return Boolean.TRUE.equals(outputMetrics.get("skipped"));
        }

        public boolean isNearDuplicate() {
            if (outputMetrics == null) return false;
            Object nearDup = outputMetrics.get("near_duplicate");
            if (nearDup instanceof Boolean) return (Boolean) nearDup;
            if (nearDup instanceof Map) return true;
            return false;
        }

        public Double getSimilarity() {
            if (outputMetrics == null) return null;
            Object sim = outputMetrics.get("similarity");
            if (sim instanceof Number) return ((Number) sim).doubleValue();
            return null;
        }

        public String getMethod() {
            if (outputMetrics == null) return null;
            return (String) outputMetrics.get("method");
        }

        public Integer getChunkCount() {
            if (outputMetrics == null) return null;
            Object count = outputMetrics.get("chunk_count");
            if (count instanceof Number) return ((Number) count).intValue();
            return null;
        }
    }
}
