package com.poliwise.knowledge.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "poliwise.onlyoffice")
@Getter
@Setter
public class OnlyOfficeProperties {
    private String documentServerUrl = "http://localhost:8888";
    private String jwtSecret = "ChangeMeInProductionPleaseUseAtLeast256Bits!"; // min 32 bytes / 256 bits
    private String callbackUrl = "http://localhost:8083/api/v1/documents";
    private String callbackPublicUrl = "http://localhost:3001/api/v1/documents";
    private int lockDurationMinutes = 30;
    private long downloadMaxBytes = 50L * 1024 * 1024;
    private int downloadConnectTimeoutMs = 5000;
    private int downloadReadTimeoutMs = 30000;
}
