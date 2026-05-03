const express = require('express');
const { z } = require('zod');
const { authenticateToken, authorizeRoles, requireProjectAccess, validate } = require('./middleware');
const { Activity, Comment, Project, Task, User } = require('./models');

const router = express.Router();

const projectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(4000).optional().default(''),
  startDate: z.string().datetime().or(z.string().min(1)),
  endDate: z.string().datetime().or(z.string().min(1)),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional().default('#5B8DEF'),
});

const memberSchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1),
});

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const query = req.user.role === 'Admin'
      ? { archivedAt: null }
      : { archivedAt: null, $or: [{ owner: req.user._id }, { members: req.user._id }] };

    const projects = await Project.find(query)
      .populate('owner', 'name email role avatarColor title')
      .populate('members', 'name email role avatarColor title')
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({ projects });
  } catch (error) {
    return next(error);
  }
});

router.post('/', authenticateToken, validate(projectSchema), async (req, res, next) => {
  try {
    if (req.user.role !== 'Admin') {
      const activeProjectCount = await Project.countDocuments({ archivedAt: null });
      if (activeProjectCount > 0) {
        return res.status(403).json({ error: 'Only admins can create projects' });
      }

      // Bootstrap path: no project exists yet, so promote creator to Admin.
      await User.findByIdAndUpdate(req.user._id, {
        role: 'Admin',
        title: 'Workspace admin',
      });
      req.user.role = 'Admin';
    }

    const project = await Project.create({
      ...req.body,
      startDate: new Date(req.body.startDate),
      endDate: new Date(req.body.endDate),
      owner: req.user._id,
      members: [req.user._id],
    });

    await Activity.create({
      project: project._id,
      actor: req.user._id,
      type: 'project.created',
      title: 'Project created',
      detail: project.name,
    });

    return res.status(201).json({ project });
  } catch (error) {
    return next(error);
  }
});

router.get('/:projectId', authenticateToken, requireProjectAccess, async (req, res, next) => {
  try {
    const tasks = await Task.find({ project: req.project._id, archivedAt: null })
      .populate('assignee', 'name email role avatarColor')
      .populate('createdBy', 'name email role avatarColor')
      .sort({ updatedAt: -1 })
      .lean();

    const stats = {
      totalTasks: tasks.length,
      completedTasks: tasks.filter((task) => task.status === 'Done').length,
      overdueTasks: tasks.filter((task) => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Done').length,
      progress: tasks.length ? Math.round((tasks.filter((task) => task.status === 'Done').length / tasks.length) * 100) : 0,
    };

    return res.json({ project: req.project, tasks, stats });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:projectId', authenticateToken, requireProjectAccess, validate(projectSchema.partial()), async (req, res, next) => {
  try {
    const ownerId = String(req.project.owner?._id || req.project.owner);
    const isOwner = ownerId === String(req.user._id);
    if (req.user.role !== 'Admin' && !isOwner) {
      return res.status(403).json({ error: 'Only admins or the project owner can edit this project' });
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.project._id,
      {
        ...req.body,
        ...(req.body.startDate ? { startDate: new Date(req.body.startDate) } : {}),
        ...(req.body.endDate ? { endDate: new Date(req.body.endDate) } : {}),
      },
      { new: true }
    )
      .populate('owner', 'name email role avatarColor title')
      .populate('members', 'name email role avatarColor title');

    await Activity.create({
      project: req.project._id,
      actor: req.user._id,
      type: 'project.updated',
      title: 'Project updated',
      detail: updatedProject.name,
    });

    return res.json({ project: updatedProject });
  } catch (error) {
    return next(error);
  }
});

router.post('/:projectId/archive', authenticateToken, authorizeRoles('Admin'), requireProjectAccess, async (req, res, next) => {
  try {
    const project = await Project.findByIdAndUpdate(req.project._id, { archivedAt: new Date() }, { new: true });
    return res.json({ project });
  } catch (error) {
    return next(error);
  }
});

/** Permanently delete project and its tasks (Admin only). */
router.delete('/:projectId', authenticateToken, authorizeRoles('Admin'), requireProjectAccess, async (req, res, next) => {
  try {
    const projectId = req.project._id;
    const taskIds = await Task.find({ project: projectId }).distinct('_id');

    await Comment.deleteMany({ task: { $in: taskIds } });
    await Task.deleteMany({ project: projectId });
    await Activity.deleteMany({
      $or: [{ project: projectId }, { task: { $in: taskIds } }],
    });
    await Project.findByIdAndDelete(projectId);

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:projectId/members', authenticateToken, authorizeRoles('Admin'), requireProjectAccess, validate(memberSchema), async (req, res, next) => {
  try {
    const users = await User.find({ _id: { $in: req.body.memberIds } }).select('_id name email role avatarColor');
    const memberIds = users.map((user) => user._id);

    const project = await Project.findByIdAndUpdate(
      req.project._id,
      { members: Array.from(new Set([...(req.project.members || []).map(String), ...memberIds.map(String)])) },
      { new: true }
    )
      .populate('owner', 'name email role avatarColor title')
      .populate('members', 'name email role avatarColor title');

    return res.json({ project });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:projectId/members/:memberId', authenticateToken, authorizeRoles('Admin'), requireProjectAccess, async (req, res, next) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.project._id,
      { $pull: { members: req.params.memberId } },
      { new: true }
    )
      .populate('owner', 'name email role avatarColor title')
      .populate('members', 'name email role avatarColor title');

    return res.json({ project });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
