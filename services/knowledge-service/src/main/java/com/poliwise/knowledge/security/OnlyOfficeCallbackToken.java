package com.poliwise.knowledge.security;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;

import java.util.Collection;

/**
 * Authentication token for OnlyOffice Document Server callbacks.
 * Uses the special "ONLYOFFICE_CALLBACK" principal.
 */
public class OnlyOfficeCallbackToken extends AbstractAuthenticationToken {

    private final OnlyOfficeCallbackPrincipal principal;

    public OnlyOfficeCallbackToken(OnlyOfficeCallbackPrincipal principal) {
        super(null);
        this.principal = principal;
        setAuthenticated(true);
    }

    public OnlyOfficeCallbackToken(OnlyOfficeCallbackPrincipal principal, Collection<? extends GrantedAuthority> authorities) {
        super(authorities);
        this.principal = principal;
        setAuthenticated(true);
    }

    @Override
    public Object getCredentials() {
        return null;
    }

    @Override
    public Object getPrincipal() {
        return principal;
    }
}
