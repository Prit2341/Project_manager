# ProjectCentral - Enterprise Project & Task Management Desktop App

A modern, high-fidelity Electron desktop application based on Google Stitch Project `#16609534881142269017` (**"Project Progress Dashboard"**).

## Features

- **Executive Dashboard**: Real-time KPI summaries, active sprint velocity, project completion gauges, and priority ticket triage.
- **Projects Portfolio**: Filterable project cards (All, In Progress, Review, Completed), search by keywords, budget tracking, and team allocations.
- **Task Manager**:
  - **Dual Views**: Instant switching between **Kanban Board** (To Do, In Progress, Done) and **Data Table List View**.
  - **Interactive Actions**: Checkbox completion toggle with dynamic status sync, priority chips (Critical, High, Medium, Low), and task deletion.
  - **Task Creation Modal**: Add new tasks with assignees, priorities, and descriptions.
- **Reporting & Analysis**:
  - Interactive SVG **Sprint Burndown Chart** comparing ideal trajectory vs actual story points.
  - Critical bottlenecks panel highlighting overdue items and triage priorities.
  - KPI performance cards with progress fill meters.
- **Desktop Features**:
  - Frameless desktop shell with custom title bar and drag region.
  - Smooth window controls: Minimize, Maximize/Restore, and Close via Electron IPC bridge.
  - Dark Mode & Light Mode toggle with local state persistence.
  - Offline-first data model with `localStorage` synchronization.

- **Local AI Assistant Copilot (Qwen 2.5 1.5B via Ollama)**:
  - **Natural Language Action Execution**: Add tasks, set priorities, update statuses, or create projects using conversational prompts.
    - Example: *"Add a task on Alpha Redesign with high priority to redesign the navigation bar"*
    - Example: *"Mark task TSK-104 as Done"*
    - Example: *"Create project Cloud Migration with $60k budget"*
    - Example: *"Delete all the projects"* or *"Remove complete db"*
    - Example: *"Reset database"* (restores initial 6 sample projects & 7 tasks in 1 click)
  - **Local 1B/1.5B Model**: Powered by **Qwen 2.5 1.5B Instruct** running locally on Ollama (utilizes only ~1.8GB VRAM on your 4GB GPU, blazing fast and 100% private).
  - **Interactive Chat Drawer**: Slide-out assistant drawer with keyboard shortcut (`Ctrl+J` / `Cmd+J`, `Esc` to close), prompt suggestion pills, and real-time action cards that refresh the Kanban board and Dashboard instantly.
  - **Dual Engine**: Instant 2ms fast-path execution with intelligent local LLM conversational reasoning.

## Database Architecture (PostgreSQL 17)

The application connects directly to a local or remote **PostgreSQL** database instance.

- **Database Name**: `projectcentral_db`
- **Driver**: `pg` (node-postgres with Connection Pooling)
- **Configuration File**: `.env` (configurable `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`)
- **Tables**:
  - `projects`: Primary project portfolio table with status, progress, budget, timeline, and lead ownership.
  - `tasks`: Sprint tasks with priority tags, status, assignees, and foreign key link (`ON DELETE CASCADE`) to `projects(id)`.
  - `settings`: Application configuration and user preferences (`theme`, `activeTab`).

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [PostgreSQL](https://www.postgresql.org/) (v14+; v17 tested and running locally)

### Configuration
Update `.env` if your PostgreSQL credentials differ from defaults:
```env
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=
PGDATABASE=projectcentral_db
```

### Installation
```bash
npm install
```

### Running the App
To launch the desktop application:
```bash
npm start
```
or
```bash
npx electron .
```

## Project Structure
```
├── main.js             # Electron main process (window management & IPC handlers)
├── preload.js          # Secure context isolation bridge (window controls)
├── package.json        # Project configuration & npm scripts
├── src/
│   ├── index.html      # App shell (titlebar, sidebar, tab panes, modals)
│   ├── app.js          # Application controller, state machine, and UI renderers
│   └── styles.css      # Custom styling, scrollbars, drag regions & animations
└── stitch_source/      # Original raw HTML screens fetched from Google Stitch
```
