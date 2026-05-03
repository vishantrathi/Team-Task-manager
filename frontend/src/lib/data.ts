export type Role = "Admin" | "Member";
export type ThemeMode = "light" | "dark";
export type TaskStatus = "To Do" | "In Progress" | "Review" | "Done";
export type TaskPriority = "Low" | "Medium" | "High" | "Urgent";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  avatarColor: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  color: string;
  ownerId: string;
  memberIds: string[];
  archived: boolean;
}

export interface TaskComment {
  id: string;
  authorId: string;
  body: string;
  mentions: string[];
  createdAt: string;
}

export interface TaskAttachment {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  assigneeId: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  labels: string[];
  status: TaskStatus;
  comments: TaskComment[];
  attachments: TaskAttachment[];
  createdById: string;
  updatedAt: string;
  archived: boolean;
}

export interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  type: string;
  actorId: string;
  projectId?: string;
  taskId?: string;
  createdAt: string;
}

export interface DashboardStats {
  label: string;
  value: string | number;
  change: string;
}

export const statusOrder: TaskStatus[] = ["To Do", "In Progress", "Review", "Done"];
