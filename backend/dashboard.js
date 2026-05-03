const express = require('express');
const { authenticateToken } = require('./middleware');
const { Activity, Project, Task } = require('./models');

const router = express.Router();

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const projectFilter = req.user.role === 'Admin'
      ? {}
      : { $or: [{ owner: req.user._id }, { members: req.user._id }] };

    const [projects, tasks, activities] = await Promise.all([
      Project.find({ ...projectFilter, archivedAt: null }).lean(),
      Task.find({
        archivedAt: null,
        ...(req.user.role === 'Admin' ? {} : { $or: [{ createdBy: req.user._id }, { assignee: req.user._id }] }),
      })
        .populate('project', 'name color')
        .populate('assignee', 'name email role avatarColor')
        .sort({ updatedAt: -1 })
        .limit(24)
        .lean(),
      Activity.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('actor', 'name email role avatarColor')
        .lean(),
    ]);

    const allTasksForUser = await Task.find({
      archivedAt: null,
      ...(req.user.role === 'Admin' ? {} : { $or: [{ createdBy: req.user._id }, { assignee: req.user._id }] }),
    }).lean();

    const accessibleProjectIds = projects.map((p) => p._id);
    const tasksForProgress = accessibleProjectIds.length
      ? await Task.find({ archivedAt: null, project: { $in: accessibleProjectIds } }).lean()
      : [];

    const totalTasks = allTasksForUser.length;
    const completedTasks = allTasksForUser.filter((task) => task.status === 'Done').length;
    const overdueTasks = allTasksForUser.filter((task) => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Done').length;
    const activeProjects = projects.length;

    const myTasks = tasks.filter((task) => String(task.assignee?._id || task.assignee) === String(req.user._id));

    const projectProgress = projects.map((project) => {
      const projectTasks = tasksForProgress.filter((task) => String(task.project) === String(project._id));
      const done = projectTasks.filter((task) => task.status === 'Done').length;
      return {
        id: project._id,
        name: project.name,
        progress: projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0,
        color: project.color,
      };
    });

    return res.json({
      stats: [
        { label: 'Projects', value: activeProjects, change: 'Active workspace' },
        { label: 'Tasks', value: totalTasks, change: req.user.role === 'Admin' ? 'Your visible tasks' : 'Assigned & created' },
        { label: 'Completed', value: completedTasks, change: totalTasks ? `${Math.round((completedTasks / totalTasks) * 100)}% of your tasks` : 'No tasks yet' },
        { label: 'Overdue', value: overdueTasks, change: overdueTasks ? `${overdueTasks} need attention` : 'None overdue' },
      ],
      projects,
      tasks,
      myTasks,
      projectProgress,
      activities,
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
