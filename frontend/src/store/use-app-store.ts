"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { statusOrder, type ActivityItem, type Project, type Role, type Task, type TaskComment, type TaskPriority, type TaskStatus, type TeamMember, type ThemeMode } from "@/lib/data";

type CreateProjectInput = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  color: string;
};

type CreateTaskInput = {
  projectId: string;
  title: string;
  description: string;
  assigneeId: string | null;
  dueDate: string | null;
  priority: TaskPriority;
  labels: string[];
  status: TaskStatus;
};

type UpdateProjectInput = Partial<CreateProjectInput>;

type UpdateTaskInput = {
  title?: string;
  description?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  labels?: string[];
  status?: TaskStatus;
};

type AppState = {
  currentUserId: string;
  currentUserRole: Role | "";
  theme: ThemeMode;
  members: TeamMember[];
  /** Admin-only: all users for member pickers */
  allUsers: TeamMember[];
  projects: Project[];
  tasks: Task[];
  activities: ActivityItem[];
  searchQuery: string;
  selectedProjectId: string;
  selectedTaskId: string | null;
  loading: boolean;
  authenticating: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: { name: string; email: string; password: string; role?: "Admin" | "Member"; adminKey?: string }) => Promise<void>;
  initializeWorkspace: () => Promise<void>;
  loadTaskComments: (taskId: string) => Promise<void>;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setSearchQuery: (searchQuery: string) => void;
  setSelectedProjectId: (projectId: string) => void;
  setSelectedTaskId: (taskId: string | null) => void;
  createProject: (input: CreateProjectInput) => Promise<void>;
  updateProject: (projectId: string, input: UpdateProjectInput) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  archiveProject: (projectId: string) => Promise<void>;
  setProjectMembers: (projectId: string, memberIds: string[]) => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<void>;
  updateTask: (taskId: string, input: UpdateTaskInput) => Promise<void>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  addComment: (taskId: string, body: string) => Promise<void>;
  logout: () => Promise<void>;
};

type RawUser = {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  role?: "Admin" | "Member";
  title?: string;
  avatarColor?: string;
};

type RawProject = {
  _id?: string;
  id?: string;
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  color?: string;
  owner?: RawUser | string;
  members?: Array<RawUser | string>;
  archivedAt?: string | null;
};

type RawTask = {
  _id?: string;
  id?: string;
  project?: RawProject | string;
  projectId?: string;
  title?: string;
  description?: string;
  assignee?: RawUser | string | null;
  assigneeId?: string | null;
  createdBy?: RawUser | string;
  createdById?: string;
  dueDate?: string | null;
  priority?: TaskPriority;
  labels?: string[];
  status?: TaskStatus;
  attachments?: Task["attachments"];
  updatedAt?: string;
  archivedAt?: string | null;
};

type RawActivity = {
  _id?: string;
  id?: string;
  title?: string;
  detail?: string;
  type?: string;
  actor?: RawUser | string;
  actorId?: string;
  project?: RawProject | string;
  projectId?: string;
  task?: RawTask | string;
  taskId?: string;
  createdAt?: string;
};

type RawComment = {
  _id?: string;
  id?: string;
  author?: RawUser | string;
  authorId?: string;
  body?: string;
  mentions?: string[];
  createdAt?: string;
};

type ApiError = Error & { status?: number };

type RawTaskResponse = {
  task: RawTask;
};

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1").replace(/\/$/, "");

function asId(value: unknown) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record._id || record.id || "");
  }

  return "";
}

function toMember(value: RawUser | string | null | undefined): TeamMember | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return {
      id: value,
      name: "Team Member",
      email: "",
      role: "Member",
      title: "Team member",
      avatarColor: "#5B8DEF",
    };
  }

  const id = asId(value);
  if (!id) {
    return null;
  }

  return {
    id,
    name: value.name || "Team Member",
    email: value.email || "",
    role: value.role || "Member",
    title: value.title || "Team member",
    avatarColor: value.avatarColor || "#5B8DEF",
  };
}

function normalizeProject(raw: RawProject): Project {
  const ownerId = asId(raw.owner);
  return {
    id: asId(raw) || crypto.randomUUID(),
    name: raw.name || "Untitled project",
    description: raw.description || "",
    startDate: raw.startDate || new Date().toISOString(),
    endDate: raw.endDate || new Date().toISOString(),
    color: raw.color || "#5B8DEF",
    ownerId,
    memberIds: (raw.members || []).map((member) => asId(member)).filter(Boolean),
    archived: Boolean(raw.archivedAt),
  };
}

function normalizeTask(raw: RawTask): Task {
  return {
    id: asId(raw) || crypto.randomUUID(),
    projectId: asId(raw.project) || raw.projectId || "",
    title: raw.title || "Untitled task",
    description: raw.description || "",
    assigneeId: asId(raw.assignee) || raw.assigneeId || null,
    dueDate: raw.dueDate || null,
    priority: raw.priority || "Medium",
    labels: raw.labels || [],
    status: raw.status || "To Do",
    comments: [],
    attachments: raw.attachments || [],
    createdById: asId(raw.createdBy) || raw.createdById || "",
    updatedAt: raw.updatedAt || new Date().toISOString(),
    archived: Boolean(raw.archivedAt),
  };
}

function normalizeActivity(raw: RawActivity): ActivityItem {
  return {
    id: asId(raw) || crypto.randomUUID(),
    title: raw.title || "Activity",
    detail: raw.detail || "",
    type: raw.type || "activity",
    actorId: asId(raw.actor) || raw.actorId || "",
    projectId: asId(raw.project) || raw.projectId || undefined,
    taskId: asId(raw.task) || raw.taskId || undefined,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

function normalizeComment(raw: RawComment): TaskComment {
  return {
    id: asId(raw) || crypto.randomUUID(),
    authorId: asId(raw.author) || raw.authorId || "",
    body: raw.body || "",
    mentions: raw.mentions || [],
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

function buildTaskActivity(task: Task, currentUserId: string, type: string, title: string, detail: string): ActivityItem {
  return {
    id: crypto.randomUUID(),
    title,
    detail,
    type,
    actorId: currentUserId,
    projectId: task.projectId || undefined,
    taskId: task.id,
    createdAt: new Date().toISOString(),
  };
}

function mergeTaskMembers(existingMembers: TeamMember[], rawTask: RawTask) {
  const memberMap = new Map(existingMembers.map((member) => [member.id, member]));

  const assignee = toMember(rawTask.assignee as RawUser);
  if (assignee) {
    memberMap.set(assignee.id, assignee);
  }

  const creator = toMember(rawTask.createdBy as RawUser);
  if (creator) {
    memberMap.set(creator.id, creator);
  }

  return Array.from(memberMap.values());
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = (payload as { error?: string }).error || `Request failed with status ${response.status}`;
    const error = new Error(message) as ApiError;
    error.status = response.status;
    throw error;
  }

  return payload as T;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUserId: "",
      currentUserRole: "",
      theme: "dark",
      members: [],
      allUsers: [],
      projects: [],
      tasks: [],
      activities: [],
      searchQuery: "",
      selectedProjectId: "",
      selectedTaskId: null,
      loading: false,
      authenticating: false,
      error: null,
      login: async (email, password) => {
        set({ authenticating: true, error: null });
        try {
          await apiRequest("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email: email.trim(), password }),
          });
          await get().initializeWorkspace();
          set({ authenticating: false, error: null });
        } catch (error) {
          set({
            authenticating: false,
            error: error instanceof Error ? error.message : "Unable to sign in",
          });
          throw error;
        }
      },
      signup: async (input) => {
        set({ authenticating: true, error: null });
        try {
          await apiRequest("/auth/signup", {
            method: "POST",
            body: JSON.stringify({
              ...input,
              name: input.name.trim(),
              email: input.email.trim(),
              adminKey: input.adminKey?.trim(),
            }),
          });
          await get().initializeWorkspace();
          set({ authenticating: false, error: null });
        } catch (error) {
          set({
            authenticating: false,
            error: error instanceof Error ? error.message : "Unable to create account",
          });
          throw error;
        }
      },
      initializeWorkspace: async () => {
        set({ loading: true, error: null });

        try {
          const meResponse = await apiRequest<{ user: RawUser }>("/auth/me");
          const me = toMember(meResponse.user);
          const isAdmin = me?.role === "Admin";

          const [projectsResponse, tasksResponse, dashboardResponse, usersResponse] = await Promise.all([
            apiRequest<{ projects: RawProject[] }>("/projects"),
            apiRequest<{ tasks: RawTask[] }>("/tasks"),
            apiRequest<{ activities?: RawActivity[] }>("/dashboard"),
            isAdmin ? apiRequest<{ users: RawUser[] }>("/users").catch(() => ({ users: [] as RawUser[] })) : Promise.resolve({ users: [] as RawUser[] }),
          ]);

          const projects = (projectsResponse.projects || []).map(normalizeProject);
          const tasks = (tasksResponse.tasks || []).map(normalizeTask);
          const activities = (dashboardResponse.activities || []).map(normalizeActivity);

          const memberMap = new Map<string, TeamMember>();
          if (me) {
            memberMap.set(me.id, me);
          }

          for (const project of projectsResponse.projects || []) {
            const owner = toMember(project.owner as RawUser);
            if (owner) {
              memberMap.set(owner.id, owner);
            }

            for (const member of project.members || []) {
              const nextMember = toMember(member as RawUser);
              if (nextMember) {
                memberMap.set(nextMember.id, nextMember);
              }
            }
          }

          for (const task of tasksResponse.tasks || []) {
            const assignee = toMember((task as RawTask).assignee as RawUser);
            if (assignee) {
              memberMap.set(assignee.id, assignee);
            }

            const creator = toMember((task as RawTask).createdBy as RawUser);
            if (creator) {
              memberMap.set(creator.id, creator);
            }
          }

          for (const activity of dashboardResponse.activities || []) {
            const actor = toMember((activity as RawActivity).actor as RawUser);
            if (actor) {
              memberMap.set(actor.id, actor);
            }
          }

          const allUsers = (usersResponse.users || [])
            .map((u) => toMember(u))
            .filter(Boolean) as TeamMember[];

          for (const u of allUsers) {
            memberMap.set(u.id, u);
          }

          set((state) => {
            const selectedProjectId = projects.some((project) => project.id === state.selectedProjectId)
              ? state.selectedProjectId
              : projects[0]?.id || "";
            const selectedTaskId = tasks.some((task) => task.id === state.selectedTaskId)
              ? state.selectedTaskId
              : null;

            return {
              currentUserId: me?.id || "",
              currentUserRole: me?.role || "",
              members: Array.from(memberMap.values()),
              allUsers,
              projects,
              tasks,
              activities,
              selectedProjectId,
              selectedTaskId,
              loading: false,
              error: null,
            };
          });
        } catch (error) {
          const apiError = error as ApiError;
          if (apiError.status === 401) {
            set({
              currentUserId: "",
              currentUserRole: "",
              members: [],
              allUsers: [],
              projects: [],
              tasks: [],
              activities: [],
              selectedProjectId: "",
              selectedTaskId: null,
              loading: false,
              error: null,
            });
            return;
          }

          set({
            loading: false,
            error: error instanceof Error ? error.message : "Unable to load workspace",
          });
        }
      },
      loadTaskComments: async (taskId) => {
        const response = await apiRequest<{ comments: RawComment[] }>(`/tasks/${taskId}/comments`);
        const comments = (response.comments || []).map(normalizeComment);

        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, comments } : task)),
        }));

        const responseMembers = response.comments
          .map((comment) => toMember(comment.author as RawUser))
          .filter(Boolean) as TeamMember[];

        if (responseMembers.length > 0) {
          set((state) => {
            const memberMap = new Map(state.members.map((member) => [member.id, member]));
            for (const member of responseMembers) {
              memberMap.set(member.id, member);
            }
            return { members: Array.from(memberMap.values()) };
          });
        }
      },
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setSelectedProjectId: (selectedProjectId) => set({ selectedProjectId }),
      setSelectedTaskId: (selectedTaskId) => set({ selectedTaskId }),
      createProject: async (input) => {
        await apiRequest("/projects", {
          method: "POST",
          body: JSON.stringify(input),
        });
        await get().initializeWorkspace();
      },
      updateProject: async (projectId, input) => {
        await apiRequest(`/projects/${projectId}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        });
        await get().initializeWorkspace();
      },
      deleteProject: async (projectId) => {
        await apiRequest(`/projects/${projectId}`, {
          method: "DELETE",
        });
        await get().initializeWorkspace();
      },
      setProjectMembers: async (projectId, memberIds) => {
        await apiRequest(`/projects/${projectId}/members`, {
          method: "PATCH",
          body: JSON.stringify({ memberIds }),
        });
        await get().initializeWorkspace();
      },
      archiveProject: async (projectId) => {
        await apiRequest(`/projects/${projectId}/archive`, {
          method: "POST",
        });
        await get().initializeWorkspace();
      },
      createTask: async (input) => {
        const response = await apiRequest<RawTaskResponse>("/tasks", {
          method: "POST",
          body: JSON.stringify(input),
        });

        const createdTask = normalizeTask(response.task);
        set((state) => ({
          tasks: [...state.tasks, createdTask],
          members: mergeTaskMembers(state.members, response.task),
          activities: [
            buildTaskActivity(createdTask, state.currentUserId, "task.created", "Task created", createdTask.title),
            ...state.activities,
          ],
        }));
      },
      updateTask: async (taskId, input) => {
        const response = await apiRequest<RawTaskResponse>(`/tasks/${taskId}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        });

        const updatedTask = normalizeTask(response.task);
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === taskId ? updatedTask : task)),
          members: mergeTaskMembers(state.members, response.task),
          activities: [
            buildTaskActivity(updatedTask, state.currentUserId, "task.updated", "Task updated", updatedTask.title),
            ...state.activities,
          ],
        }));
      },
      updateTaskStatus: async (taskId, status) => {
        const response = await apiRequest<RawTaskResponse>(`/tasks/${taskId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });

        const updatedTask = normalizeTask(response.task);
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === taskId ? updatedTask : task)),
          members: mergeTaskMembers(state.members, response.task),
          activities: [
            buildTaskActivity(updatedTask, state.currentUserId, "task.status.changed", "Task status updated", `${updatedTask.title} -> ${status}`),
            ...state.activities,
          ],
        }));
      },
      deleteTask: async (taskId) => {
        await apiRequest(`/tasks/${taskId}`, {
          method: "DELETE",
        });
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== taskId),
          selectedTaskId: state.selectedTaskId === taskId ? null : state.selectedTaskId,
        }));
      },
      addComment: async (taskId, body) => {
        await apiRequest(`/tasks/${taskId}/comments`, {
          method: "POST",
          body: JSON.stringify({ body }),
        });
        await get().loadTaskComments(taskId);
      },
      logout: async () => {
        try {
          await apiRequest("/auth/logout", { method: "POST" });
        } catch {
          /* still clear client */
        }
        set({
          currentUserId: "",
          currentUserRole: "",
          members: [],
          allUsers: [],
          projects: [],
          tasks: [],
          activities: [],
          selectedProjectId: "",
          selectedTaskId: null,
        });
      },
    }),
    {
      name: "team-task-manager",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        searchQuery: state.searchQuery,
        selectedProjectId: state.selectedProjectId,
        selectedTaskId: state.selectedTaskId,
      }),
    }
  )
);

export function getProjectProgress(tasks: Task[]) {
  const total = tasks.length;
  const done = tasks.filter((task) => task.status === "Done").length;
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export function getBoardCounts(tasks: Task[]) {
  return statusOrder.map((status) => ({
    status,
    count: tasks.filter((task) => task.status === status).length,
  }));
}