const express = require('express');
const { z } = require('zod');
const { authenticateToken, validate } = require('./middleware');
const { Activity, Comment, Project, Task, User } = require('./models');

const router = express.Router();

const taskSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(6000).optional().default(''),
  assigneeId: z.string().min(1).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional().default('Medium'),
  labels: z.array(z.string().trim().min(1).max(32)).optional().default([]),
  status: z.enum(['To Do', 'In Progress', 'Review', 'Done']).optional().default('To Do'),
  attachments: z.array(z.object({
    name: z.string(),
    url: z.string(),
    mimeType: z.string().optional(),
    size: z.number().optional(),
  })).optional().default([]),
});

const taskUpdateSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(6000).optional(),
  assigneeId: z.string().min(1).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).optional(),
  labels: z.array(z.string().trim().min(1).max(32)).optional(),
  status: z.enum(['To Do', 'In Progress', 'Review', 'Done']).optional(),
}).strict().refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });

const commentSchema = z.object({
  body: z.string().trim().min(1).max(3000),
});

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    let query = { archivedAt: null };
    
    if (req.user.role !== 'Admin') {
      const accessibleProjectIds = await Project.find({
        archivedAt: null,
        $or: [{ owner: req.user._id }, { members: req.user._id }],
      }).distinct('_id');

      // User can see tasks from projects they have access to OR tasks assigned to them
      query.$or = [
        { project: { $in: accessibleProjectIds } },
        { assignee: req.user._id }
      ];
    }

    if (req.query.projectId) {
      if (req.user.role !== 'Admin') {
        const project = await Project.findById(req.query.projectId);
        const hasAccess = project && (String(project.owner) === String(req.user._id) || project.members.some((member) => String(member) === String(req.user._id)));
        if (!hasAccess) {
          return res.status(403).json({ error: 'Forbidden' });
        }
      }
      query.project = req.query.projectId;
      delete query.$or; // If filtering by projectId, remove the $or clause
    }

    if (req.query.status) {
      query.status = req.query.status;
    }
    if (req.query.priority) {
      query.priority = req.query.priority;
    }
    if (req.query.assignee) {
      query.assignee = req.query.assignee;
    }
    if (req.query.q) {
      query.title = { $regex: req.query.q, $options: 'i' };
    }

    const tasks = await Task.find(query)
      .populate('project', 'name color archivedAt')
      .populate('assignee', 'name email role avatarColor title')
      .populate('createdBy', 'name email role avatarColor title')
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({ tasks });
  } catch (error) {
    return next(error);
  }
});

router.post('/', authenticateToken, validate(taskSchema), async (req, res, next) => {
  try {
    const project = await Project.findById(req.body.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const canAccess = req.user.role === 'Admin' || String(project.owner) === String(req.user._id) || project.members.some((member) => String(member) === String(req.user._id));
    if (!canAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const assignee = req.body.assigneeId ? await User.findById(req.body.assigneeId).select('_id') : null;

    const task = await Task.create({
      project: project._id,
      title: req.body.title,
      description: req.body.description,
      assignee: assignee?._id || null,
      createdBy: req.user._id,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      priority: req.body.priority,
      labels: req.body.labels,
      status: req.body.status,
      attachments: req.body.attachments,
    });

    await Activity.create({
      project: project._id,
      task: task._id,
      actor: req.user._id,
      type: 'task.created',
      title: 'Task created',
      detail: task.title,
    });

    return res.status(201).json({ task });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:taskId', authenticateToken, validate(taskUpdateSchema), async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const project = await Project.findById(task.project);
    const isAdmin = req.user.role === 'Admin';
    const isProjectOwner = String(project.owner) === String(req.user._id);
    const isProjectMember = project.members.some((member) => String(member) === String(req.user._id));
    const isAssignee = String(task.assignee) === String(req.user._id);
    const isCreator = String(task.createdBy) === String(req.user._id);

    // Allow updates by: admin, project owner, project member, task assignee, or task creator
    const canAccess = isAdmin || isProjectOwner || isProjectMember || isAssignee || isCreator;
    if (!canAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const body = req.body;
    const updates = {};

    if (body.title !== undefined) {
      updates.title = body.title;
    }
    if (body.description !== undefined) {
      updates.description = body.description;
    }
    if (body.priority !== undefined) {
      updates.priority = body.priority;
    }
    if (body.labels !== undefined) {
      updates.labels = body.labels;
    }
    if (body.status !== undefined) {
      updates.status = body.status;
    }
    if (body.dueDate !== undefined) {
      updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }
    if (body.assigneeId !== undefined) {
      if (body.assigneeId) {
        const assignee = await User.findById(body.assigneeId).select('_id');
        if (!assignee) {
          return res.status(400).json({ error: 'Assignee not found' });
        }
        updates.assignee = assignee._id;
      } else {
        updates.assignee = null;
      }
    }

    const updatedTask = await Task.findByIdAndUpdate(task._id, updates, { new: true })
      .populate('project', 'name color archivedAt')
      .populate('assignee', 'name email role avatarColor title')
      .populate('createdBy', 'name email role avatarColor title');

    await Activity.create({
      project: project._id,
      task: task._id,
      actor: req.user._id,
      type: 'task.updated',
      title: 'Task updated',
      detail: updatedTask.title,
    });

    return res.json({ task: updatedTask });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:taskId/status', authenticateToken, async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['To Do', 'In Progress', 'Review', 'Done'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const project = await Project.findById(task.project);
    const isAdmin = req.user.role === 'Admin';
    const isProjectOwner = String(project.owner) === String(req.user._id);
    const isProjectMember = project.members.some((member) => String(member) === String(req.user._id));
    const isAssignee = String(task.assignee) === String(req.user._id);

    const canAccess = isAdmin || isProjectOwner || isProjectMember || isAssignee;
    if (!canAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    task.status = status;
    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate('project', 'name color archivedAt')
      .populate('assignee', 'name email role avatarColor title')
      .populate('createdBy', 'name email role avatarColor title');

    await Activity.create({
      project: project._id,
      task: task._id,
      actor: req.user._id,
      type: 'task.status.changed',
      title: 'Task status updated',
      detail: `${task.title} -> ${status}`,
    });

    return res.json({ task: updatedTask });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:taskId', authenticateToken, async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const project = await Project.findById(task.project);
    const isAdmin = req.user.role === 'Admin';
    const isProjectOwner = String(project.owner) === String(req.user._id);
    const isProjectMember = project.members.some((member) => String(member) === String(req.user._id));
    const isAssignee = String(task.assignee) === String(req.user._id);
    const isCreator = String(task.createdBy) === String(req.user._id);

    // Allow deletion by: admin, project owner, project member, task assignee, or task creator
    const canDelete = isAdmin || isProjectOwner || isProjectMember || isAssignee || isCreator;
    if (!canDelete) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await Task.findByIdAndDelete(task._id);
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.get('/:taskId/comments', authenticateToken, async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const project = await Project.findById(task.project);
    const canAccess = req.user.role === 'Admin'
      || String(project.owner) === String(req.user._id)
      || project.members.some((member) => String(member) === String(req.user._id));
    if (!canAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const comments = await Comment.find({ task: req.params.taskId })
      .populate('author', 'name email role avatarColor title')
      .sort({ createdAt: 1 })
      .lean();

    return res.json({ comments });
  } catch (error) {
    return next(error);
  }
});

router.post('/:taskId/comments', authenticateToken, validate(commentSchema), async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const project = await Project.findById(task.project);
    const canAccess = req.user.role === 'Admin' || String(project.owner) === String(req.user._id) || project.members.some((member) => String(member) === String(req.user._id));
    if (!canAccess) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const mentions = Array.from(new Set((req.body.body.match(/@([a-zA-Z0-9._-]+)/g) || []).map((value) => value.slice(1))));
    const mentionedUsers = mentions.length ? await User.find({ email: { $in: mentions.map((mention) => `${mention.toLowerCase()}`) } }).select('_id') : [];

    const comment = await Comment.create({
      task: task._id,
      author: req.user._id,
      body: req.body.body,
      mentions: mentionedUsers.map((user) => user._id),
    });

    return res.status(201).json({ comment });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
