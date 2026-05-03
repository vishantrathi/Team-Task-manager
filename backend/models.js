const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['Admin', 'Member'], default: 'Member', index: true },
    avatarColor: { type: String, default: '#5B8DEF' },
    title: { type: String, default: 'Team member' },
    refreshToken: refreshTokenSchema,
  },
  { timestamps: true }
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120, index: 'text' },
    description: { type: String, default: '', maxlength: 4000 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    color: { type: String, default: '#5B8DEF' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    archivedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

projectSchema.index({ owner: 1, archivedAt: 1 });
projectSchema.index({ members: 1, archivedAt: 1 });

const taskSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 160, index: 'text' },
    description: { type: String, default: '', maxlength: 6000 },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dueDate: { type: Date, default: null, index: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium', index: true },
    labels: [{ type: String, trim: true, maxlength: 32 }],
    status: {
      type: String,
      enum: ['To Do', 'In Progress', 'Review', 'Done'],
      default: 'To Do',
      index: true,
    },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    attachments: [
      {
        name: String,
        url: String,
        mimeType: String,
        size: Number,
      },
    ],
    archivedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

taskSchema.index({ project: 1, status: 1, archivedAt: 1 });
taskSchema.index({ assignee: 1, dueDate: 1, archivedAt: 1 });

const commentSchema = new mongoose.Schema(
  {
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 3000 },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

const activitySchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true, index: true },
    title: { type: String, required: true },
    detail: { type: String, default: '' },
  },
  { timestamps: true }
);

/** Pending signup: user is created only after OTP verification. */
const signupVerificationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    intendedRole: { type: String, enum: ['Admin', 'Member'], default: 'Member' },
    otpHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

signupVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const User = mongoose.model('User', userSchema);
const Project = mongoose.model('Project', projectSchema);
const Task = mongoose.model('Task', taskSchema);
const Comment = mongoose.model('Comment', commentSchema);
const Activity = mongoose.model('Activity', activitySchema);
const SignupVerification = mongoose.model('SignupVerification', signupVerificationSchema);

module.exports = { Activity, Comment, Project, SignupVerification, Task, User };
