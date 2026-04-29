# Authorization & Access Control

## Overview

Poliwise uses Role-Based Access Control (RBAC) with JWT authentication across all services.

## Role Hierarchy

```
ADMIN (level 3)
   │
   ├── MANAGER (level 2)
   │      │
   │      └── USER (level 1)
   │
   └── USER (level 1)
```

Roles are hierarchical:
- ADMIN has all permissions
- MANAGER has all USER permissions plus additional management features
- USER has basic read access

## JWT Claims

```json
{
  "sub": "user-uuid",
  "username": "john.doe",
  "email": "john@company.com",
  "role": "ADMIN",
  "department": "department-uuid",
  "status": "ACTIVE",
  "iat": 1234567890,
  "exp": 1234571490
}
```

## Permission Matrix

### Document Management

| Action | USER | MANAGER | ADMIN |
|--------|------|---------|-------|
| View documents | ✅ | ✅ | ✅ |
| Search documents | ✅ | ✅ | ✅ |
| Download documents | ✅ | ✅ | ✅ |
| Upload documents | ❌ | ❌ | ✅ |
| Delete documents | ❌ | ❌ | ✅ |
| View audit logs | ❌ | ✅ | ✅ |

### Metadata Management

| Action | USER | MANAGER | ADMIN |
|--------|------|---------|-------|
| View categories | ✅ | ✅ | ✅ |
| Manage categories | ❌ | ❌ | ✅ |
| View tags | ✅ | ✅ | ✅ |
| Manage tags | ❌ | ✅ | ✅ |
| Set access rules | ❌ | ❌ | ✅ |

### Document Lifecycle

| Action | USER | MANAGER | ADMIN |
|--------|------|---------|-------|
| View drafts | Own only | Own only | ✅ |
| Publish documents | ❌ | ❌ | ✅ |
| Archive documents | ❌ | ❌ | ✅ |

### User Management

| Action | USER | MANAGER | ADMIN |
|--------|------|---------|-------|
| View own profile | ✅ | ✅ | ✅ |
| View all users | ❌ | ❌ | ✅ |
| Create users | ❌ | ❌ | ✅ |
| Update users | ❌ | ❌ | ✅ |
| Deactivate users | ❌ | ❌ | ✅ |

### Analytics

| Action | USER | MANAGER | ADMIN |
|--------|------|---------|-------|
| View analytics | ❌ | ✅ | ✅ |
| Export reports | ❌ | ✅ | ✅ |
| View audit logs | ❌ | ✅ | ✅ |

### AI Q&A

| Action | USER | MANAGER | ADMIN |
|--------|------|---------|-------|
| Ask questions | ✅ | ✅ | ✅ |
| View conversation history | Own only | ✅ | ✅ |
| Provide answers | ❌ | ✅ | ✅ |

## Implementation

### API Gateway (NestJS)

JWT validation and role checking in guards:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Post('documents/upload')
handleDocumentUpload(@Req() request: Request) {
  // Only ADMIN can upload documents
}
```

### Spring Boot Services

Annotation-based authorization:

```java
@PreAuthorize("hasRole('ADMIN')")
public ResponseEntity<DocumentResponse> upload(...) {
  // Only ADMIN can access
}
```

### Frontend

Role-based UI rendering:

```typescript
const { user, isAdmin } = useAuth();
{isAdmin && <UploadButton />}
```

## Access Rules

Document-level access control via access rules:

### Rule Types

| Type | Description |
|------|-------------|
| `ROLE` | Grant/deny access by role |
| `DEPARTMENT` | Grant/deny access by department |
| `USER` | Grant/deny access by specific user |

### Permission Types

| Permission | Description |
|------------|-------------|
| `VIEW` | Allow viewing the document |
| `DENY` | Explicitly deny access |

### Rule Evaluation

1. ADMIN always has access
2. PUBLIC documents accessible to all authenticated users
3. DENY rules evaluated first
4. VIEW rules evaluated second
5. No matching rule = deny

## Security Considerations

### Token Management

- Access token: 1 hour expiry
- Refresh token: 7 days expiry
- Tokens stored in localStorage (with refresh mechanism)
- 401 triggers automatic refresh and retry

### Password Policy

- Minimum 8 characters
- Must include uppercase, lowercase, number
- Password change required after 90 days
- 5 failed login attempts = account lock

### Session Management

- Multiple sessions supported
- View and revoke sessions from profile
- Logout all sessions option
- Session timeout: 30 minutes inactivity
