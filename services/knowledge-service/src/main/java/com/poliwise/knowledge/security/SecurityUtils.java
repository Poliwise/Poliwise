package com.poliwise.knowledge.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

public final class SecurityUtils {

    private SecurityUtils() {}

    public static UUID getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken token) {
            return token.getUserId();
        }
        return null;
    }

    public static String getCurrentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken token) {
            return token.getUsername();
        }
        return null;
    }

    public static UserRole getCurrentUserRole() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken token) {
            return token.getRole();
        }
        return null;
    }

    public static UUID getCurrentDepartmentId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken token) {
            return token.getDepartment();
        }
        return null;
    }

    public static boolean isAdmin() {
        UserRole role = getCurrentUserRole();
        return role == UserRole.ADMIN;
    }

    public static boolean isManagerOrAdmin() {
        UserRole role = getCurrentUserRole();
        return role == UserRole.MANAGER || role == UserRole.ADMIN;
    }
}