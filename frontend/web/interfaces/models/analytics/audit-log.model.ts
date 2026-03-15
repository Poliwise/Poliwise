import { AuditAction, ResourceType } from "@/interfaces/enums/analytics";

export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  userRole: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  changedFields?: string[];
  ipAddress: string;
  userAgent: string;
  traceId: string;
  serviceName: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}
