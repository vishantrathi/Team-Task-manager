"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, formatDistanceToNow, isBefore } from "date-fns";
import { useRouter } from "next/navigation";
import { BarChart3, Bell, CalendarDays, CheckCircle2, ChevronRight, CirclePlus, Clock3, LayoutGrid, ListFilter, LogOut, MessageSquare, MoonStar, Search, SunMedium, UserRound } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { z } from "zod";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { statusOrder, type Project, type Task, type TaskPriority, type TaskStatus } from "@/lib/data";
import { cn } from "@/lib/utils";
import { getBoardCounts, getProjectProgress, useAppStore } from "@/store/use-app-store";

const projectSchema = z.object({
  name: z.string().min(2, "Project name is required"),
  description: z.string().min(10, "Add a short summary"),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  color: z.string().min(4),
});

const taskSchema = z.object({
  projectId: z.string().min(1, "Choose a project"),
  title: z.string().min(2, "Task title is required"),
  description: z.string().min(10, "Add details for the assignee"),
  assigneeId: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]),
  labels: z.string().optional(),
  status: z.enum(["To Do", "In Progress", "Review", "Done"]),
});

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function priorityTone(priority: TaskPriority) {
  switch (priority) {
    case "Urgent":
      return "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200";
    case "High":
      return "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-200";
    case "Medium":
      return "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200";
    default:
      return "border-neutral-200 bg-neutral-100 text-neutral-800 dark:border-white/10 dark:bg-white/10 dark:text-neutral-200";
  }
}

function statusTone(status: TaskStatus) {
  switch (status) {
    case "Done":
      return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/15 dark:text-emerald-200";
    case "Review":
      return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 dark:border-fuchsia-400/20 dark:bg-fuchsia-500/15 dark:text-fuchsia-200";
    case "In Progress":
      return "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-400/20 dark:bg-sky-500/15 dark:text-sky-200";
    default:
      return "border-neutral-200 bg-neutral-100 text-neutral-800 dark:border-neutral-200 dark:bg-white/10 dark:text-neutral-200";
  }
}

function splitLabels(value?: string) {
  return value
    ? value
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean)
    : [];
}

function TaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createTask = useAppStore((state) => state.createTask);
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const allProjects = useAppStore((state) => state.projects);
  const members = useAppStore((state) => state.members);
  const [projectValue, setProjectValue] = useState(selectedProjectId);
  const projects = useMemo(() => allProjects.filter((project) => !project.archived), [allProjects]);

  const form = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      projectId: selectedProjectId,
      title: "",
      description: "",
      assigneeId: "",
      dueDate: "",
      priority: "Medium",
      labels: "",
      status: "To Do",
    },
  });

  useEffect(() => {
    if (open) {
      setProjectValue(selectedProjectId);
      form.reset({
        projectId: selectedProjectId,
        title: "",
        description: "",
        assigneeId: "",
        dueDate: "",
        priority: "Medium",
        labels: "",
        status: "To Do",
      });
    }
  }, [form, open, selectedProjectId]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createTask({
        projectId: values.projectId,
        title: values.title,
        description: values.description,
        assigneeId: values.assigneeId || null,
        dueDate: values.dueDate || null,
        priority: values.priority,
        labels: splitLabels(values.labels),
        status: values.status,
      });
      toast.success("Task added to the board");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create task");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
          <DialogDescription>Add a new task with assignee, priority, labels, and status.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            Project
            <select className="h-11 rounded-2xl border border-neutral-200 bg-white px-4 text-neutral-900 outline-none dark:border-white/15 dark:bg-neutral-950 dark:text-white" value={projectValue} {...form.register("projectId")} onChange={(event) => { setProjectValue(event.target.value); form.setValue("projectId", event.target.value); }}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            Task title
            <Input placeholder="Ship review flow" {...form.register("title")} />
          </label>
          <label className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            Description
            <Textarea placeholder="Describe the outcome, constraints, and quality bar." {...form.register("description")} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              Assignee
              <select className="h-11 rounded-2xl border border-neutral-200 bg-white px-4 text-neutral-900 outline-none dark:border-white/15 dark:bg-neutral-950 dark:text-white" {...form.register("assigneeId")}>
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} - {member.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              Due date
              <Input type="date" {...form.register("dueDate")} />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              Priority
              <select className="h-11 rounded-2xl border border-neutral-200 bg-white px-4 text-neutral-900 outline-none dark:border-white/15 dark:bg-neutral-950 dark:text-white" {...form.register("priority")}>
                {(["Low", "Medium", "High", "Urgent"] as const).map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              Status
              <select className="h-11 rounded-2xl border border-neutral-200 bg-white px-4 text-neutral-900 outline-none dark:border-white/15 dark:bg-neutral-950 dark:text-white" {...form.register("status")}>
                {statusOrder.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            Labels
            <Input placeholder="UX, Launch" {...form.register("labels")} />
          </label>
          <div className="flex items-center justify-end gap-3 pt-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit">Create task</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createProject = useAppStore((state) => state.createProject);
  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      description: "",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10),
      color: "#0EA5E9",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createProject(values);
      toast.success("Project created");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create project");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>Spin up a new initiative with timeline, color, and scope.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            Project name
            <Input placeholder="Northstar Mobile" {...form.register("name")} />
          </label>
          <label className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            Description
            <Textarea placeholder="Why this project matters and what success looks like." {...form.register("description")} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              Start date
              <Input type="date" {...form.register("startDate")} />
            </label>
            <label className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              End date
              <Input type="date" {...form.register("endDate")} />
            </label>
          </div>
          <label className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            Accent color
            <Input type="color" className="h-11 w-full rounded-2xl border border-neutral-200 p-1 dark:border-white/15" {...form.register("color")} />
          </label>
          <div className="flex items-center justify-end gap-3 pt-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit">Create project</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectEditDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateProject = useAppStore((state) => state.updateProject);
  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      description: "",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      color: "#0EA5E9",
    },
  });

  useEffect(() => {
    if (project && open) {
      form.reset({
        name: project.name,
        description: project.description,
        startDate: project.startDate.slice(0, 10),
        endDate: project.endDate.slice(0, 10),
        color: project.color,
      });
    }
  }, [project, open, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!project) {
      return;
    }
    try {
      await updateProject(project.id, values);
      toast.success("Project updated");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update project");
    }
  });

  if (!project) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-neutral-900 dark:text-white">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>Update timeline, description, or accent color.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            Project name
            <Input placeholder="Northstar Mobile" {...form.register("name")} />
          </label>
          <label className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            Description
            <Textarea placeholder="Scope and success criteria." {...form.register("description")} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              Start date
              <Input type="date" {...form.register("startDate")} />
            </label>
            <label className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              End date
              <Input type="date" {...form.register("endDate")} />
            </label>
          </div>
          <label className="grid gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            Accent color
            <Input type="color" className="h-11 w-full rounded-2xl border border-neutral-200 p-1 dark:border-white/15" {...form.register("color")} />
          </label>
          <div className="flex items-center justify-end gap-3 pt-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" className="bg-[#ff6200] text-white hover:bg-[#e45700]">
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProjectMembersDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const allUsers = useAppStore((state) => state.allUsers);
  const setProjectMembers = useAppStore((state) => state.setProjectMembers);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (project && open) {
      setSelected(new Set([project.ownerId, ...project.memberIds]));
    }
  }, [project, open]);

  if (!project) {
    return null;
  }

  const toggle = (id: string) => {
    if (id === project.ownerId) {
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-neutral-900 dark:text-white">
        <DialogHeader>
          <DialogTitle>Project team</DialogTitle>
          <DialogDescription>Choose members with access to {project.name}. The owner always stays on the team.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[360px] gap-2 overflow-y-auto pr-1">
          {allUsers.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Load users as an admin to assign teammates.</p>
          ) : (
            allUsers.map((u) => (
              <label
                key={u.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 p-3 dark:border-white/10"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#ff6200]"
                  checked={selected.has(u.id)}
                  disabled={u.id === project.ownerId}
                  onChange={() => toggle(u.id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{u.name}</div>
                  <div className="truncate text-xs text-neutral-500 dark:text-neutral-400">{u.email}</div>
                </div>
                {u.id === project.ownerId ? (
                  <Badge className="border-neutral-200 bg-neutral-100 text-neutral-800 dark:border-white/15 dark:bg-white/10 dark:text-neutral-200">Owner</Badge>
                ) : null}
              </label>
            ))
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-[#ff6200] text-white hover:bg-[#e45700]"
            onClick={async () => {
              try {
                await setProjectMembers(project.id, Array.from(selected));
                toast.success("Team updated");
                onOpenChange(false);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Unable to update team");
              }
            }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TaskDetailDialog({ task, open, onOpenChange }: { task: Task | undefined; open: boolean; onOpenChange: (open: boolean) => void }) {
  const members = useAppStore((state) => state.members);
  const projects = useAppStore((state) => state.projects);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const currentUserRole = useAppStore((state) => state.currentUserRole);
  const addComment = useAppStore((state) => state.addComment);
  const loadTaskComments = useAppStore((state) => state.loadTaskComments);
  const updateTaskStatus = useAppStore((state) => state.updateTaskStatus);
  const updateTask = useAppStore((state) => state.updateTask);
  const deleteTask = useAppStore((state) => state.deleteTask);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editPriority, setEditPriority] = useState<TaskPriority>("Medium");
  const [editLabels, setEditLabels] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus>("To Do");

  useEffect(() => {
    if (!open) {
      setComment("");
      setEditing(false);
      return;
    }

    if (task) {
      setEditTitle(task.title);
      setEditDescription(task.description);
      setEditAssigneeId(task.assigneeId || "");
      setEditDue(task.dueDate ? task.dueDate.slice(0, 10) : "");
      setEditPriority(task.priority);
      setEditLabels(task.labels.join(", "));
      setEditStatus(task.status);
      void loadTaskComments(task.id).catch(() => {
        toast.error("Unable to load task comments");
      });
    }
  }, [loadTaskComments, open, task]);

  if (!task) {
    return null;
  }

  const project = projects.find((item) => item.id === task.projectId);
  const assignee = members.find((member) => member.id === task.assigneeId);
  const author = members.find((member) => member.id === task.createdById);
  const canDeleteTask = currentUserRole === "Admin" || (project && project.ownerId === currentUserId);

  const fieldClass = "rounded-2xl border border-neutral-200 bg-white px-3 text-neutral-900 outline-none dark:border-white/15 dark:bg-neutral-950 dark:text-white";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl text-neutral-900 dark:text-white">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn("border", statusTone(task.status))}>{task.status}</Badge>
            <Badge className={cn("border", priorityTone(task.priority))}>{task.priority}</Badge>
          </div>
          <DialogTitle>{editing ? "Edit task" : task.title}</DialogTitle>
          <DialogDescription className="text-neutral-600 dark:text-neutral-400">
            {project?.name} • updated {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-4 dark:border-white/10">
          <Button size="sm" variant={editing ? "secondary" : "outline"} className="rounded-xl" onClick={() => setEditing((e) => !e)}>
            {editing ? "Close editor" : "Edit details"}
          </Button>
          {canDeleteTask && (
            <Button
              size="sm"
              variant="destructive"
              className="rounded-xl"
              onClick={async () => {
                if (!globalThis.confirm("Delete this task permanently?")) {
                  return;
                }
                try {
                  await deleteTask(task.id);
                  toast.success("Task deleted");
                  onOpenChange(false);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Unable to delete");
                }
              }}
            >
              Delete task
            </Button>
          )}
        </div>
        <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <div className="grid gap-4">
            {editing ? (
              <div className="grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
                <label className="grid gap-1 text-sm text-neutral-600 dark:text-neutral-300">
                  Title
                  <Input className={fieldClass} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </label>
                <label className="grid gap-1 text-sm text-neutral-600 dark:text-neutral-300">
                  Description
                  <Textarea className={cn(fieldClass, "min-h-[100px]")} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm text-neutral-600 dark:text-neutral-300">
                    Assignee
                    <select className={cn(fieldClass, "h-11")} value={editAssigneeId} onChange={(e) => setEditAssigneeId(e.target.value)}>
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm text-neutral-600 dark:text-neutral-300">
                    Due date
                    <Input className={fieldClass} type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm text-neutral-600 dark:text-neutral-300">
                    Priority
                    <select className={cn(fieldClass, "h-11")} value={editPriority} onChange={(e) => setEditPriority(e.target.value as TaskPriority)}>
                      {(["Low", "Medium", "High", "Urgent"] as const).map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm text-neutral-600 dark:text-neutral-300">
                    Status
                    <select className={cn(fieldClass, "h-11")} value={editStatus} onChange={(e) => setEditStatus(e.target.value as TaskStatus)}>
                      {statusOrder.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="grid gap-1 text-sm text-neutral-600 dark:text-neutral-300">
                  Labels (comma-separated)
                  <Input className={fieldClass} value={editLabels} onChange={(e) => setEditLabels(e.target.value)} placeholder="design, launch" />
                </label>
                <Button
                  className="rounded-xl bg-[#ff6200] text-white hover:bg-[#e45700]"
                  onClick={async () => {
                    try {
                      await updateTask(task.id, {
                        title: editTitle.trim(),
                        description: editDescription.trim(),
                        assigneeId: editAssigneeId || null,
                        dueDate: editDue || null,
                        priority: editPriority,
                        labels: splitLabels(editLabels),
                        status: editStatus,
                      });
                      toast.success("Task updated");
                      setEditing(false);
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Unable to update task");
                    }
                  }}
                >
                  Save changes
                </Button>
              </div>
            ) : (
              <Card className="border-neutral-200 bg-neutral-50 dark:border-white/10 dark:bg-white/5">
                <CardContent className="grid gap-4">
                  <p className="text-sm leading-7 text-neutral-700 dark:text-neutral-300">{task.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {task.labels.map((label) => (
                      <Badge key={label} className="border border-neutral-200 bg-white text-neutral-800 dark:border-white/10 dark:bg-white/10 dark:text-neutral-200">
                        #{label}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            <div className="grid gap-3">
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Comments</p>
              {task.comments.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-neutral-200 p-4 text-sm text-neutral-500 dark:border-white/15 dark:text-neutral-400">
                  No comments yet. Use @email to mention teammates.
                </p>
              ) : (
                task.comments.map((entry) => {
                  const commenter = members.find((member) => member.id === entry.authorId);
                  return (
                    <div key={entry.id} className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                        <span>{commenter?.name}</span>
                        <span>{formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}</span>
                      </div>
                      <p className="text-sm leading-6 text-neutral-800 dark:text-neutral-200">{entry.body}</p>
                    </div>
                  );
                })
              )}
              <div className="grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-neutral-950/40">
                <Textarea
                  className={fieldClass}
                  value={comment}
                  placeholder="Write a comment…"
                  onChange={(event) => setComment(event.target.value)}
                />
                <div className="flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setComment("")}>
                    Clear
                  </Button>
                  <Button
                    className="bg-[#ff6200] text-white hover:bg-[#e45700]"
                    onClick={async () => {
                      if (!comment.trim()) {
                        return;
                      }

                      try {
                        await addComment(task.id, comment.trim());
                        toast.success("Comment added");
                        setComment("");
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Unable to add comment");
                      }
                    }}
                  >
                    Add comment
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-4">
            <Card className="border-neutral-200 bg-neutral-50 dark:border-white/10 dark:bg-white/5">
              <CardContent className="grid gap-4 text-sm text-neutral-600 dark:text-neutral-300">
                <div className="flex items-center justify-between gap-3">
                  <span>Project</span>
                  <strong className="text-neutral-900 dark:text-white">{project?.name}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Assignee</span>
                  <strong className="text-neutral-900 dark:text-white">{assignee?.name || "Unassigned"}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Created by</span>
                  <strong className="text-neutral-900 dark:text-white">{author?.name || "Team"}</strong>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Due</span>
                  <strong
                    className={cn(
                      "text-neutral-900 dark:text-white",
                      task.dueDate && isBefore(new Date(task.dueDate), new Date()) && task.status !== "Done" && "text-rose-600 dark:text-rose-300"
                    )}
                  >
                    {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "No due date"}
                  </strong>
                </div>
                {task.attachments.length > 0 && (
                  <div className="grid gap-2">
                    <span>Attachments</span>
                    {task.attachments.map((attachment) => (
                      <div
                        key={attachment.name}
                        className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-neutral-950/40"
                      >
                        <span>{attachment.name}</span>
                        <span>{attachment.size ? `${Math.round(attachment.size / 1024)} KB` : "File"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="grid gap-2">
              {statusOrder.map((status) => (
                <Button
                  key={status}
                  variant={task.status === status ? "default" : "outline"}
                  className="justify-start rounded-2xl border-neutral-200 dark:border-white/15"
                  onClick={async () => {
                    try {
                      await updateTaskStatus(task.id, status);
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Unable to update task status");
                    }
                  }}
                >
                  Move to {status}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ icon: Icon, label, value, change }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; change: string }) {
  return (
    <Card className="border border-neutral-200 bg-white shadow-sm dark:border-white/10 dark:bg-neutral-900/80">
      <CardContent className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{label}</p>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-white">{value}</div>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{change}</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-[#ff6200] dark:border-white/10 dark:bg-white/5">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

const sidebarNavItems: Array<[string, string, React.ComponentType<{ className?: string }>]> = [
  ["dashboard", "Dashboard", LayoutGrid],
  ["board", "Board", ListFilter],
  ["tasks", "Tasks", CheckCircle2],
  ["projects", "Projects", CalendarDays],
];

export function AppShell() {
  const router = useRouter();
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const logout = useAppStore((state) => state.logout);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const setSearchQuery = useAppStore((state) => state.setSearchQuery);
  const selectedProjectId = useAppStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useAppStore((state) => state.setSelectedProjectId);
  const setSelectedTaskId = useAppStore((state) => state.setSelectedTaskId);
  const initializeWorkspace = useAppStore((state) => state.initializeWorkspace);
  const allProjects = useAppStore((state) => state.projects);
  const allTasks = useAppStore((state) => state.tasks);
  const members = useAppStore((state) => state.members);
  const currentUserId = useAppStore((state) => state.currentUserId);
  const currentUserRole = useAppStore((state) => state.currentUserRole);
  const deleteProject = useAppStore((state) => state.deleteProject);
  const error = useAppStore((state) => state.error);
  const activities = useAppStore((state) => state.activities);
  const selectedTaskId = useAppStore((state) => state.selectedTaskId);

  const [projectOpen, setProjectOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [editProjectTarget, setEditProjectTarget] = useState<Project | null>(null);
  const [membersProjectTarget, setMembersProjectTarget] = useState<Project | null>(null);
  const [workspaceNoticeDismissed, setWorkspaceNoticeDismissed] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("team-task-manager-theme", theme);
  }, [theme]);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("team-task-manager-theme") as typeof theme | null;
    if (storedTheme) {
      useAppStore.getState().setTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    const dismissed = window.localStorage.getItem("team-task-manager-workspace-notice-dismissed") === "true";
    setWorkspaceNoticeDismissed(dismissed);
  }, []);

  const projects = useMemo(() => allProjects.filter((project) => !project.archived), [allProjects]);
  const tasks = useMemo(() => allTasks.filter((task) => !task.archived), [allTasks]);

  useEffect(() => {
    if (projects.length > 0 || tasks.length > 0) {
      setWorkspaceNoticeDismissed(false);
      window.localStorage.removeItem("team-task-manager-workspace-notice-dismissed");
    }
  }, [projects.length, tasks.length]);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0];
  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) : undefined;

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      const project = projects.find((candidate) => candidate.id === task.projectId);
      const term = searchQuery.trim().toLowerCase();
      const inProject = selectedProject ? task.projectId === selectedProject.id : true;
      const matchesSearch = !term || [task.title, task.description, project?.name, task.labels.join(" ")]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(term));

      return inProject && matchesSearch;
    });
  }, [projects, searchQuery, selectedProject, tasks]);

  const boardData = useMemo(() => statusOrder.map((status) => ({
    status,
    tasks: visibleTasks.filter((task) => task.status === status),
  })), [visibleTasks]);

  const stats = useMemo(() => {
    const overdue = visibleTasks.filter((task) => task.dueDate && isBefore(new Date(task.dueDate), new Date()) && task.status !== "Done").length;
    const done = visibleTasks.filter((task) => task.status === "Done").length;
    const pct = visibleTasks.length ? Math.round((done / visibleTasks.length) * 100) : 0;
    return [
      { icon: LayoutGrid, label: "Projects", value: projects.length, change: "Filtered workspace" },
      { icon: ListFilter, label: "Tasks", value: visibleTasks.length, change: "In current project filter" },
      { icon: CheckCircle2, label: "Completed", value: done, change: visibleTasks.length ? `${pct}% of filtered tasks` : "No tasks in filter" },
      { icon: Clock3, label: "Overdue", value: overdue, change: overdue ? "Past due & not done" : "None in this view" },
    ];
  }, [projects.length, visibleTasks]);

  const chartData = useMemo(() => getBoardCounts(visibleTasks), [visibleTasks]);
  const projectCards = useMemo(() => {
    return projects.map((project) => {
      const projectTasks = tasks.filter((task) => task.projectId === project.id);
      const overdue = projectTasks.filter((task) => task.dueDate && isBefore(new Date(task.dueDate), new Date()) && task.status !== "Done").length;
      return {
        project,
        progress: getProjectProgress(projectTasks),
        overdue,
        members: project.memberIds.map((memberId) => members.find((member) => member.id === memberId)).filter(Boolean),
      };
    });
  }, [members, projects, tasks]);

  const myTasks = useMemo(() => tasks.filter((task) => task.assigneeId === currentUserId), [currentUserId, tasks]);
  const currentUser = useMemo(() => members.find((member) => member.id === currentUserId) || null, [currentUserId, members]);

  const openTaskDialog = () => {
    if (projects.length === 0) {
      if (currentUserRole === "Admin") {
        toast.error("Create a project first, then add tasks.");
      } else {
        toast.error("No project available yet. Ask an admin to create a project first.");
      }
      return;
    }
    setTaskOpen(true);
  };

  return (
    <div className="relative min-h-screen bg-neutral-100 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="relative mx-auto grid min-h-screen max-w-[1680px] gap-6 p-4 lg:grid-cols-[320px_1fr] lg:p-6">
        <aside className="flex flex-col gap-5 rounded-[32px] border border-neutral-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-900 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:overflow-hidden">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400">Workspace</div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">Team Task Manager</div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-[#ff6200] dark:border-white/10 dark:bg-white/5">
              <BarChart3 className="h-5 w-5" />
            </div>
          </div>
          <div className="rounded-[28px] border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-[#ff6200] text-white">{initials(currentUser?.name || "Team")}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate font-medium">{currentUser?.name || "Team Member"}</div>
                <div className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                  {currentUser?.title || "Workspace member"} · {currentUserRole || "—"}
                </div>
              </div>
            </div>
            <Separator className="my-4 bg-neutral-200 dark:bg-white/10" />
            <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-300">
              <span>Theme</span>
              <div className="flex items-center gap-2">
                <SunMedium className="h-4 w-4 text-[#ff6200]" />
                <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
                <MoonStar className="h-4 w-4 text-neutral-500" />
              </div>
            </div>
            <Button
              variant="outline"
              className="mt-4 w-full justify-start gap-2 rounded-2xl border-neutral-200 dark:border-white/15"
              onClick={async () => {
                await logout();
                toast.success("Signed out");
                router.push("/login");
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>

          <nav className="grid gap-2">
            {sidebarNavItems.map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={cn(
                  "flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                  activeTab === value
                    ? "border-[#ff6200]/40 bg-[#ff6200]/10 text-neutral-900 dark:bg-[#ff6200]/15 dark:text-white"
                    : "border-neutral-200 bg-neutral-50 text-neutral-800 hover:bg-neutral-100 dark:border-white/10 dark:bg-white/5 dark:text-neutral-100 dark:hover:bg-white/10"
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
                <ChevronRight className="h-4 w-4 opacity-60" />
              </button>
            ))}
          </nav>

          <div className="grid gap-4 rounded-[28px] border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-300">
              <span>Search</span>
              <Search className="h-4 w-4" />
            </div>
            <Input
              className="border-neutral-200 bg-white dark:border-white/15 dark:bg-neutral-950"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search projects or tasks"
            />
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400">
              <span>Projects</span>
              {currentUserRole === "Admin" ? (
                <Button size="sm" variant="ghost" className="text-[#ff6200]" onClick={() => setProjectOpen(true)}>
                  <CirclePlus className="h-4 w-4" />
                  New
                </Button>
              ) : null}
            </div>
            <div className="grid gap-2 overflow-auto pr-1 lg:max-h-[240px]">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    setActiveTab("projects");
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition",
                    selectedProjectId === project.id
                      ? "border-[#ff6200]/50 bg-[#ff6200]/10 dark:bg-[#ff6200]/15"
                      : "border-neutral-200 bg-white hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900/50 dark:hover:bg-white/5"
                  )}
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{project.name}</span>
                    <span className="block truncate text-xs text-neutral-500 dark:text-neutral-400">{project.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <Separator className="bg-neutral-200 dark:bg-white/10" />

          <div className="grid gap-3 text-sm text-neutral-600 dark:text-neutral-300">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <UserRound className="h-4 w-4" />
                People in view
              </span>
              <span>{members.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Recent activity rows
              </span>
              <span>{activities.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Alerts
              </span>
              <span className="text-neutral-400">—</span>
            </div>
          </div>

          <div className="mt-auto rounded-[28px] border border-neutral-200 bg-neutral-50 p-5 dark:border-white/10 dark:bg-white/5">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">Tip</div>
            <div className="mt-2 text-base font-semibold text-neutral-900 dark:text-white">Filter by project in the sidebar</div>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              Admins can create projects, manage members, and delete projects. Owners can edit project details.
            </p>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col gap-6">
          {error && projects.length === 0 && tasks.length === 0 && !workspaceNoticeDismissed && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div className="grid gap-1">
                  <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">Backend unavailable</div>
                  <div className="text-sm text-amber-800/90 dark:text-amber-50/90">{error}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void initializeWorkspace()}>Retry</Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setWorkspaceNoticeDismissed(true);
                        window.localStorage.setItem("team-task-manager-workspace-notice-dismissed", "true");
                      }}
                    >
                      Dismiss
                    </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <section className="rounded-[34px] border border-neutral-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-900 lg:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs uppercase tracking-[0.2em] text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400">
                  Overview
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">
                  Projects, tasks, and delivery in one calm view.
                </h1>
                <p className="mt-3 max-w-3xl text-base leading-7 text-neutral-600 dark:text-neutral-400">
                  Use the sidebar to focus a project. Drag cards on the board, open a task for full detail, edits, and comments.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {currentUserRole === "Admin" ? (
                  <Button variant="outline" onClick={() => setProjectOpen(true)}>
                    <CirclePlus className="h-4 w-4" />
                    New project
                  </Button>
                ) : null}
                <Button className="bg-[#ff6200] text-white hover:bg-[#e45700]" onClick={openTaskDialog}>
                  <CirclePlus className="h-4 w-4" />
                  New task
                </Button>
              </div>
            </div>
          </section>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-2">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="board">Kanban board</TabsTrigger>
              <TabsTrigger value="tasks">List view</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <div className="grid gap-5 xl:grid-cols-4">
                {stats.map(({ icon, label, value, change }) => <StatCard key={label} icon={icon} label={label} value={value} change={change} />)}
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Task pipeline</CardTitle>
                      <CardDescription>Work distribution across the workflow.</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72 min-h-[288px] min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-white/10" />
                          <XAxis dataKey="status" tick={{ fill: "currentColor", fontSize: 12 }} className="text-neutral-500" axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: "currentColor", fontSize: 12 }} className="text-neutral-500" axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip
                            cursor={{ fill: "rgba(255,98,0,0.06)" }}
                            contentStyle={{ background: "rgba(255,255,255,0.98)", border: "1px solid #e5e5e5", borderRadius: 16 }}
                          />
                          <Bar dataKey="count" radius={[16, 16, 0, 0]} fill="#ff6200" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Recent activity</CardTitle>
                      <CardDescription>Updates from across the workspace.</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4">
                      {activities.slice(0, 5).map((entry) => {
                        const actor = members.find((member) => member.id === entry.actorId);
                        return (
                          <div key={entry.id} className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-white/10 dark:bg-white/5">
                            <Avatar>
                              <AvatarFallback style={{ backgroundColor: actor?.avatarColor || "#334155" }}>{initials(actor?.name || "Team")}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <div className="truncate text-sm font-medium text-neutral-900 dark:text-white">{entry.title}</div>
                                <div className="text-xs text-neutral-500 dark:text-neutral-400">{formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}</div>
                              </div>
                              <div className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{entry.detail}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>My tasks</CardTitle>
                      <CardDescription>Items assigned to {currentUser?.name || "you"}.</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    {myTasks.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-neutral-200 p-6 text-sm text-neutral-500 dark:border-white/10 dark:text-neutral-400">
                        No personal tasks right now.
                      </div>
                    ) : (
                      myTasks.map((task) => (
                        <button
                          key={task.id}
                          type="button"
                          onClick={() => setSelectedTaskId(task.id)}
                          className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-left transition hover:bg-neutral-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                        >
                          <div>
                            <div className="font-medium text-neutral-900 dark:text-white">{task.title}</div>
                            <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                              {projects.find((p) => p.id === task.projectId)?.name || "Project"}
                            </div>
                          </div>
                          <Badge className={cn("border", statusTone(task.status))}>{task.status}</Badge>
                        </button>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div>
                      <CardTitle>Project progress</CardTitle>
                      <CardDescription>Current delivery trajectory.</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    {projectCards.map(({ project, progress, overdue, members }) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => setSelectedProjectId(project.id)}
                        className="grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-left transition hover:bg-neutral-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-neutral-900 dark:text-white">{project.name}</div>
                            <div className="text-sm text-neutral-500 dark:text-neutral-400">{project.description}</div>
                          </div>
                          <div className="text-right text-sm text-neutral-600 dark:text-neutral-300">{progress}%</div>
                        </div>
                        <div className="h-2 rounded-full bg-neutral-200 dark:bg-white/10">
                          <div className="h-2 rounded-full" style={{ width: `${progress}%`, backgroundColor: project.color }} />
                        </div>
                        <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                          <span>{members.length} members</span>
                          <span>{overdue ? `${overdue} overdue` : "On track"}</span>
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="board">
              <div className="grid gap-4 xl:grid-cols-4">
                {boardData.map((column) => (
                  <div key={column.status} className="rounded-[30px] border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5" onDragOver={(event) => event.preventDefault()} onDrop={() => {
                    if (draggedTaskId) {
                      void useAppStore.getState().updateTaskStatus(draggedTaskId, column.status).then(() => {
                        toast.success(`Moved to ${column.status}`);
                      }).catch((dragError) => {
                        toast.error(dragError instanceof Error ? dragError.message : "Unable to move task");
                      });
                      setDraggedTaskId(null);
                    }
                  }}>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-neutral-900 dark:text-white">{column.status}</div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400">{column.tasks.length} tasks</div>
                      </div>
                      <Badge className={cn("border", statusTone(column.status))}>{column.tasks.length}</Badge>
                    </div>
                    <div className="grid gap-3">
                      {column.tasks.map((task) => {
                        const project = projects.find((item) => item.id === task.projectId);
                        const assignee = members.find((member) => member.id === task.assigneeId);
                        return (
                          <article key={task.id} draggable onDragStart={() => setDraggedTaskId(task.id)} onClick={() => setSelectedTaskId(task.id)} className="cursor-pointer rounded-[26px] border border-neutral-200 bg-white p-4 transition hover:-translate-y-1 hover:border-[#ff6200]/40 dark:border-white/10 dark:bg-neutral-950/80 dark:hover:bg-neutral-900">
                            <div className="flex items-center justify-between gap-3">
                              <Badge className={cn("border", priorityTone(task.priority))}>{task.priority}</Badge>
                              <span className="text-xs text-neutral-500 dark:text-neutral-400">{project?.name}</span>
                            </div>
                            <h3 className="mt-3 text-base font-medium text-neutral-900 dark:text-white">{task.title}</h3>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{task.description}</p>
                            <div className="mt-4 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <Avatar>
                                  <AvatarFallback style={{ backgroundColor: assignee?.avatarColor || "#334155" }}>{initials(assignee?.name || "Team")}</AvatarFallback>
                                </Avatar>
                                <div className="text-xs text-neutral-500 dark:text-neutral-400">{assignee?.name || "Unassigned"}</div>
                              </div>
                              <Badge className={cn("border", statusTone(task.status))}>{task.status}</Badge>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="tasks">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>All tasks</CardTitle>
                    <CardDescription>Search, sort, and inspect work across the workspace.</CardDescription>
                  </div>
                  <Button variant="outline" onClick={openTaskDialog}><CirclePlus className="h-4 w-4" />Task</Button>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {visibleTasks.map((task) => {
                    const project = projects.find((item) => item.id === task.projectId);
                    const assignee = members.find((member) => member.id === task.assigneeId);
                    return (
                      <button key={task.id} type="button" onClick={() => setSelectedTaskId(task.id)} className="grid gap-4 rounded-[26px] border border-neutral-200 bg-neutral-50 p-4 text-left transition hover:bg-neutral-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 lg:grid-cols-[1fr_auto] lg:items-center">
                        <div className="grid gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={cn("border", statusTone(task.status))}>{task.status}</Badge>
                            <Badge className={cn("border", priorityTone(task.priority))}>{task.priority}</Badge>
                            {task.labels.map((label) => (
                              <Badge key={label} className="border border-neutral-200 bg-white text-neutral-800 dark:border-white/10 dark:bg-white/10 dark:text-neutral-200">
                                #{label}
                              </Badge>
                            ))}
                          </div>
                          <div className="text-lg font-medium text-neutral-900 dark:text-white">{task.title}</div>
                          <div className="text-sm leading-6 text-neutral-600 dark:text-neutral-400">{task.description}</div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-neutral-700 dark:text-neutral-300">
                          <div className="text-right">
                            <div>{project?.name}</div>
                            <div className={cn("text-xs", task.dueDate && isBefore(new Date(task.dueDate), new Date()) && task.status !== "Done" ? "text-rose-600 dark:text-rose-300" : "text-neutral-500 dark:text-neutral-400")}>{task.dueDate ? format(new Date(task.dueDate), "MMM d") : "No due date"}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Avatar>
                              <AvatarFallback style={{ backgroundColor: assignee?.avatarColor || "#334155" }}>{initials(assignee?.name || "Team")}</AvatarFallback>
                            </Avatar>
                            <div className="text-xs text-neutral-500 dark:text-neutral-400">{assignee?.name || "Unassigned"}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="projects">
              <div className="grid gap-5 xl:grid-cols-2">
                {projectCards.map(({ project, progress, overdue, members: projMembers }) => (
                  <Card key={project.id}>
                    <CardHeader className="flex-col items-stretch gap-4 sm:flex-row sm:items-start">
                      <div className="flex min-w-0 flex-1 gap-3">
                        <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
                        <div className="min-w-0">
                          <CardTitle className="pr-2">{project.name}</CardTitle>
                          <CardDescription className="line-clamp-2">{project.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {currentUserRole === "Admin" || project.ownerId === currentUserId ? (
                          <Button size="sm" variant="outline" type="button" onClick={() => setEditProjectTarget(project)}>
                            Edit
                          </Button>
                        ) : null}
                        {currentUserRole === "Admin" ? (
                          <>
                            <Button size="sm" variant="outline" type="button" onClick={() => setMembersProjectTarget(project)}>
                              Team
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              type="button"
                              onClick={async () => {
                                if (!globalThis.confirm(`Permanently delete “${project.name}” and all its tasks?`)) {
                                  return;
                                }
                                try {
                                  await deleteProject(project.id);
                                  toast.success("Project deleted");
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : "Unable to delete project");
                                }
                              }}
                            >
                              Delete
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-300">
                        <span>
                          {format(new Date(project.startDate), "MMM d")} - {format(new Date(project.endDate), "MMM d")}
                        </span>
                        <span>{progress}% complete</span>
                      </div>
                      <div className="h-2 rounded-full bg-neutral-200 dark:bg-white/10">
                        <div className="h-2 rounded-full" style={{ width: `${progress}%`, backgroundColor: project.color }} />
                      </div>
                      <div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400">
                        <span>{projMembers.length} team members</span>
                        <span>{overdue ? `${overdue} overdue` : "Healthy"}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {projMembers.map((member) => member && (
                          <div key={member.id} className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs text-neutral-800 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200">
                            <Avatar>
                              <AvatarFallback style={{ backgroundColor: member.avatarColor }}>{initials(member.name)}</AvatarFallback>
                            </Avatar>
                            {member.name}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      <ProjectDialog open={projectOpen} onOpenChange={setProjectOpen} />
      <ProjectEditDialog
        project={editProjectTarget}
        open={Boolean(editProjectTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setEditProjectTarget(null);
          }
        }}
      />
      <ProjectMembersDialog
        project={membersProjectTarget}
        open={Boolean(membersProjectTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setMembersProjectTarget(null);
          }
        }}
      />
      <TaskDialog open={taskOpen} onOpenChange={setTaskOpen} />
      <TaskDetailDialog
        task={selectedTask}
        open={Boolean(selectedTaskId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTaskId(null);
          }
        }}
      />
    </div>
  );
}