import { UserRole } from "@/interfaces/enums/core/user-role.enum";
import { AccountStatus } from "@/interfaces/enums/core/account-status.enum";

export interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  parentId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
