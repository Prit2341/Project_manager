const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || undefined,
  database: process.env.PGDATABASE || 'projectcentral_db',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Seed data from Stitch
const initialProjects = [
  {
    id: 'PRJ-01',
    title: 'Alpha Redesign',
    category: 'Design & Frontend',
    description: 'Complete overhaul of the core enterprise dashboard interface with modern UI tokens and responsive grids.',
    status: 'In Progress',
    progress: 68,
    due_date: 'Nov 15, 2026',
    lead_name: 'Sarah Chen',
    lead_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
    team_size: 4,
    spent: '$45,000',
    budget: '$47,400',
    tag: 'Critical Path'
  },
  {
    id: 'PRJ-02',
    title: 'Beta Mobile Companion App',
    category: 'iOS & Android',
    description: 'Native mobile client for executives to monitor project milestones and approve deliverables on the go.',
    status: 'Review',
    progress: 92,
    due_date: 'Oct 28, 2026',
    lead_name: 'Alex Rivera',
    lead_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    team_size: 6,
    spent: '$78,000',
    budget: '$80,000',
    tag: 'Final Polish'
  },
  {
    id: 'PRJ-03',
    title: 'Cloud Infrastructure Migration',
    category: 'DevOps & Reliability',
    description: 'Migrating legacy monolith clusters to multi-region Kubernetes with automated blue-green deployments.',
    status: 'In Progress',
    progress: 45,
    due_date: 'Dec 12, 2026',
    lead_name: 'David Kim',
    lead_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
    team_size: 3,
    spent: '$28,000',
    budget: '$30,000',
    tag: 'Infrastructure'
  },
  {
    id: 'PRJ-04',
    title: 'Enterprise Security & Audit',
    category: 'SecOps & Compliance',
    description: 'SOC2 Type II compliance readiness audit, penetration testing, and zero-trust IAM policy rollout.',
    status: 'Completed',
    progress: 100,
    due_date: 'Oct 05, 2026',
    lead_name: 'Elena Rostova',
    lead_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    team_size: 2,
    spent: '$19,500',
    budget: '$20,000',
    tag: 'Compliance'
  },
  {
    id: 'PRJ-05',
    title: 'Kinetic Design System 2.0',
    category: 'UI/UX Foundation',
    description: 'Unified component library with Tailwind design tokens, typography scales, and dark mode tokens.',
    status: 'In Progress',
    progress: 80,
    due_date: 'Nov 01, 2026',
    lead_name: 'Marcus Vance',
    lead_avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&auto=format&fit=crop&q=80',
    team_size: 5,
    spent: '$24,000',
    budget: '$25,000',
    tag: 'Design System'
  },
  {
    id: 'PRJ-06',
    title: 'Real-time Event Pipeline v3',
    category: 'Data Engineering',
    description: 'High-throughput Kafka and ClickHouse ingestion pipeline for real-time customer event analytics.',
    status: 'In Progress',
    progress: 30,
    due_date: 'Dec 20, 2026',
    lead_name: 'Priya Patel',
    lead_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80',
    team_size: 4,
    spent: '$48,000',
    budget: '$50,000',
    tag: 'Data Platform'
  }
];

const initialTasks = [
  {
    id: 'TSK-101',
    project_id: 'PRJ-01',
    title: 'Implement design tokens in Tailwind theme',
    description: 'Verify color tokens, typography scales, and elevation levels match Kinetic Enterprise specs.',
    priority: 'High',
    status: 'Done',
    assignee_name: 'Sarah Chen',
    assignee_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
    due_date: 'Today'
  },
  {
    id: 'TSK-102',
    project_id: 'PRJ-01',
    title: 'Setup Electron IPC bridge & window controls',
    description: 'Enable frameless desktop window controls (minimize, maximize, close) with safe context isolation.',
    priority: 'Critical',
    status: 'Done',
    assignee_name: 'Alex Rivera',
    assignee_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    due_date: 'Today'
  },
  {
    id: 'TSK-103',
    project_id: 'PRJ-01',
    title: 'Build interactive sprint burndown chart',
    description: 'Replace static mock images with dynamic SVG burndown visualizer and tooltip telemetry.',
    priority: 'Medium',
    status: 'In Progress',
    assignee_name: 'David Kim',
    assignee_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
    due_date: 'Tomorrow'
  },
  {
    id: 'TSK-104',
    project_id: 'PRJ-01',
    title: 'Resolve critical Webpack bundle bottleneck',
    description: 'Tree-shake heavyweight iconography and optimize chunk splitting for fast local launch.',
    priority: 'Critical',
    status: 'In Progress',
    assignee_name: 'Elena Rostova',
    assignee_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    due_date: 'Yesterday'
  },
  {
    id: 'TSK-105',
    project_id: 'PRJ-02',
    title: 'Configure OAuth authentication workflow',
    description: 'Verify callback handlers and local credential caching for seamless desktop sign-in.',
    priority: 'High',
    status: 'Todo',
    assignee_name: 'Marcus Vance',
    assignee_avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&auto=format&fit=crop&q=80',
    due_date: 'Oct 25'
  },
  {
    id: 'TSK-106',
    project_id: 'PRJ-03',
    title: 'Prepare desktop user documentation and release notes',
    description: 'Draft user guide highlighting keyboard shortcuts, multi-project workflows, and data sync.',
    priority: 'Low',
    status: 'Todo',
    assignee_name: 'Priya Patel',
    assignee_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80',
    due_date: 'Nov 02'
  },
  {
    id: 'TSK-107',
    project_id: 'PRJ-02',
    title: 'Cross-platform QA verification on Windows & macOS',
    description: 'Verify DPI scaling, menu bar shortcuts, and window persistence across displays.',
    priority: 'High',
    status: 'Todo',
    assignee_name: 'Sarah Chen',
    assignee_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
    due_date: 'Nov 05'
  }
];

async function initDatabase() {
  const client = await pool.connect();
  try {
    // 1. Create Tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        description TEXT,
        status VARCHAR(50) NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        due_date VARCHAR(50),
        lead_name VARCHAR(100),
        lead_avatar TEXT,
        team_size INTEGER DEFAULT 1,
        spent VARCHAR(50),
        budget VARCHAR(50),
        tag VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(50) PRIMARY KEY,
        project_id VARCHAR(50) REFERENCES projects(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        priority VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        assignee_name VARCHAR(100),
        assignee_avatar TEXT,
        due_date VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value TEXT
      );
    `);

    // 2. Auto-seed if projects table is empty
    const { rows: pRows } = await client.query('SELECT COUNT(*) as count FROM projects');
    if (parseInt(pRows[0].count, 10) === 0) {
      console.log('Seeding initial projects to PostgreSQL...');
      for (const p of initialProjects) {
        await client.query(`
          INSERT INTO projects (id, title, category, description, status, progress, due_date, lead_name, lead_avatar, team_size, spent, budget, tag)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [p.id, p.title, p.category, p.description, p.status, p.progress, p.due_date, p.lead_name, p.lead_avatar, p.team_size, p.spent, p.budget, p.tag]);
      }

      console.log('Seeding initial tasks to PostgreSQL...');
      for (const t of initialTasks) {
        await client.query(`
          INSERT INTO tasks (id, project_id, title, description, priority, status, assignee_name, assignee_avatar, due_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [t.id, t.project_id, t.title, t.description, t.priority, t.status, t.assignee_name, t.assignee_avatar, t.due_date]);
      }

      await client.query(`
        INSERT INTO settings (key, value)
        VALUES ('theme', 'light'), ('activeTab', 'dashboard')
        ON CONFLICT (key) DO NOTHING
      `);
    }

    console.log('PostgreSQL database initialized successfully.');
  } finally {
    client.release();
  }
}

// Data Access Methods
async function getAllData() {
  const [pResult, tResult, sResult] = await Promise.all([
    pool.query('SELECT * FROM projects ORDER BY created_at ASC'),
    pool.query('SELECT * FROM tasks ORDER BY created_at ASC'),
    pool.query('SELECT * FROM settings')
  ]);

  const settingsMap = {};
  sResult.rows.forEach(r => { settingsMap[r.key] = r.value; });

  // Map to frontend-friendly camelCase
  const projects = pResult.rows.map(p => ({
    id: p.id,
    title: p.title,
    category: p.category,
    description: p.description,
    status: p.status,
    progress: p.progress,
    dueDate: p.due_date,
    lead: p.lead_name,
    leadAvatar: p.lead_avatar,
    teamSize: p.team_size,
    spent: p.spent,
    budget: p.budget,
    tag: p.tag
  }));

  const tasks = tResult.rows.map(t => ({
    id: t.id,
    projectId: t.project_id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: t.status,
    assignee: t.assignee_name,
    assigneeAvatar: t.assignee_avatar,
    dueDate: t.due_date
  }));

  return { projects, tasks, settings: settingsMap };
}

async function saveProject(p) {
  const query = `
    INSERT INTO projects (id, title, category, description, status, progress, due_date, lead_name, lead_avatar, team_size, spent, budget, tag, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      category = EXCLUDED.category,
      description = EXCLUDED.description,
      status = EXCLUDED.status,
      progress = EXCLUDED.progress,
      due_date = EXCLUDED.due_date,
      lead_name = EXCLUDED.lead_name,
      lead_avatar = EXCLUDED.lead_avatar,
      team_size = EXCLUDED.team_size,
      spent = EXCLUDED.spent,
      budget = EXCLUDED.budget,
      tag = EXCLUDED.tag,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  const values = [
    p.id,
    p.title,
    p.category || '',
    p.description || '',
    p.status || 'In Progress',
    p.progress || 0,
    p.dueDate || p.due_date || '',
    p.lead || p.lead_name || '',
    p.leadAvatar || p.lead_avatar || '',
    p.teamSize || p.team_size || 1,
    p.spent || '$0',
    p.budget || '$0',
    p.tag || 'Project'
  ];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

async function deleteProject(id) {
  await pool.query('DELETE FROM projects WHERE id = $1', [id]);
  return { success: true, id };
}

async function saveTask(t) {
  const query = `
    INSERT INTO tasks (id, project_id, title, description, priority, status, assignee_name, assignee_avatar, due_date, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE SET
      project_id = EXCLUDED.project_id,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      priority = EXCLUDED.priority,
      status = EXCLUDED.status,
      assignee_name = EXCLUDED.assignee_name,
      assignee_avatar = EXCLUDED.assignee_avatar,
      due_date = EXCLUDED.due_date,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  const values = [
    t.id,
    t.projectId || t.project_id || 'PRJ-01',
    t.title,
    t.description || '',
    t.priority || 'Medium',
    t.status || 'Todo',
    t.assignee || t.assignee_name || '',
    t.assigneeAvatar || t.assignee_avatar || '',
    t.dueDate || t.due_date || 'Next Sprint'
  ];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

async function updateTaskStatus(id, status) {
  const query = `
    UPDATE tasks
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [status, id]);
  return rows[0];
}

async function deleteTask(id) {
  await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
  return { success: true, id };
}

async function saveSetting(key, value) {
  const query = `
    INSERT INTO settings (key, value)
    VALUES ($1, $2)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
  `;
  await pool.query(query, [key, value]);
  return { key, value };
}

async function getDatabaseInfo() {
  const client = await pool.connect();
  try {
    const versionRes = await client.query('SELECT version();');
    const dbSizeRes = await client.query("SELECT pg_size_pretty(pg_database_size('projectcentral_db')) as size;");
    const pCountRes = await client.query('SELECT count(*) FROM projects;');
    const tCountRes = await client.query('SELECT count(*) FROM tasks;');

    return {
      connected: true,
      database: 'projectcentral_db',
      host: process.env.PGHOST || 'localhost',
      port: process.env.PGPORT || '5432',
      user: process.env.PGUSER || 'postgres',
      version: versionRes.rows[0].version.split(',')[0],
      size: dbSizeRes.rows[0].size,
      projectsCount: parseInt(pCountRes.rows[0].count, 10),
      tasksCount: parseInt(tCountRes.rows[0].count, 10)
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message
    };
  } finally {
    client.release();
  }
}

async function deleteAllProjects() {
  await pool.query('DELETE FROM projects;');
  return { success: true };
}

async function deleteAllTasks() {
  await pool.query('DELETE FROM tasks;');
  return { success: true };
}

async function clearDatabase() {
  await pool.query('DELETE FROM tasks;');
  await pool.query('DELETE FROM projects;');
  return { success: true };
}

async function resetToDefaults() {
  await pool.query('DELETE FROM tasks;');
  await pool.query('DELETE FROM projects;');
  for (const p of initialProjects) {
    await saveProject({
      id: p.id,
      title: p.title,
      category: p.category,
      description: p.description,
      status: p.status,
      progress: p.progress,
      dueDate: p.due_date,
      lead: p.lead_name,
      leadAvatar: p.lead_avatar,
      teamSize: p.team_size,
      spent: p.spent,
      budget: p.budget,
      tag: p.tag
    });
  }
  for (const t of initialTasks) {
    await saveTask({
      id: t.id,
      projectId: t.project_id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      assignee: t.assignee_name,
      assigneeAvatar: t.assignee_avatar,
      dueDate: t.due_date
    });
  }
  return { success: true };
}

module.exports = {
  pool,
  initDatabase,
  getAllData,
  saveProject,
  deleteProject,
  deleteAllProjects,
  saveTask,
  updateTaskStatus,
  deleteTask,
  deleteAllTasks,
  clearDatabase,
  resetToDefaults,
  saveSetting,
  getDatabaseInfo
};

