package com.poliwise.knowledge.security;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.UUID;

/**
 * Principal representing an authenticated OnlyOffice Document Server callback.
 * Populated by OnlyOfficeCallbackFilter when a valid OnlyOffice JWT is present.
 */
@Getter
@AllArgsConstructor
public class OnlyOfficeCallbackPrincipal {
    private final String action;
    private final UUID documentId;
    private final String key;
}
