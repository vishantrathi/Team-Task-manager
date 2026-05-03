# Team Task Manager Backend

## Setup

1. Copy `.env.example` to `.env` and set `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and `ADMIN_INVITE_CODE`.
2. Make sure MongoDB is running locally or point `MONGODB_URI` at a remote MongoDB instance.
3. Install dependencies:
	```bash
	npm install
	```
4. Start the server:
	```bash
	npm run dev
	```

## API Endpoints
- `POST /api/auth/signup` — Register a new user
- `POST /api/auth/login` — Login and get JWT
- `GET /api/projects` — List all projects
- `POST /api/projects` — Create project (Admin only)
- `GET /api/tasks/project/:projectId` — List tasks for a project
- `POST /api/tasks` — Create a task

More endpoints and docs coming soon.
