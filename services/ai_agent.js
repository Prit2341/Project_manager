const db = require('../database/db');

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:1.5b';

/**
 * Check if Ollama is running and whether the model is downloaded
 */
async function getAgentStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { online: false, model: DEFAULT_MODEL, installed: false, error: 'Ollama returned ' + res.status };
    }

    const data = await res.json();
    const models = data.models || [];
    const hasModel = models.some(m => m.name.includes('qwen2.5:1.5b') || m.name.includes('qwen2.5') || m.name.includes('1.5b'));

    return {
      online: true,
      model: DEFAULT_MODEL,
      installed: hasModel,
      availableModels: models.map(m => m.name)
    };
  } catch (e) {
    return {
      online: false,
      model: DEFAULT_MODEL,
      installed: false,
      error: 'Ollama service offline (Using Local NLP Engine)'
    };
  }
}

/**
 * Pull the Qwen 2.5 1.5B model from Ollama library
 */
async function pullModel(modelName = DEFAULT_MODEL, onProgress) {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true })
    });

    if (!res.ok) throw new Error('Pull failed with status ' + res.status);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: isDone } = await reader.read();
      done = isDone;
      if (value) {
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (onProgress) onProgress(data);
          } catch (err) {}
        }
      }
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Intelligent Intent Classification
 */
function classifyIntent(prompt) {
  const p = prompt.trim();
  const lower = p.toLowerCase();

  // 1. Greetings
  if (/^(hi|hello|hey|good\s+(morning|afternoon|evening)|howdy|sup)[\s!.,?]*$/i.test(lower)) {
    return 'GREETING';
  }

  // 2. Capabilities / Help / What can you do
  if (
    lower.match(/\b(what\s+(things\s+)?(can\s+you|you\s+can)\s+do|what\s+can\s+you\s+do|what\s+you\s+can\s+do|capabilities|what\s+are\s+your\s+features|who\s+are\s+you|help|commands|how\s+to\s+use)\b/i) ||
    lower.includes('what things you can do') ||
    lower.includes('what can you do') ||
    lower.includes('what you can do')
  ) {
    return 'CAPABILITIES';
  }

  // 3. Bulk database operations & resets
  if (
    lower.includes('remove complete db') ||
    lower.includes('clear database') ||
    lower.includes('wipe database') ||
    lower.includes('empty database') ||
    lower.includes('delete complete db') ||
    lower.includes('clear the db') ||
    lower.includes('wipe db')
  ) {
    return 'ACTION_CLEAR_DATABASE';
  }

  if (
    lower.includes('delete all the projects') ||
    lower.includes('delete all projects') ||
    lower.includes('remove all projects') ||
    lower.includes('clear all projects') ||
    lower.includes('wipe all projects')
  ) {
    return 'ACTION_DELETE_ALL_PROJECTS';
  }

  if (
    lower.includes('delete all the tasks') ||
    lower.includes('delete all tasks') ||
    lower.includes('remove all tasks') ||
    lower.includes('clear all tasks') ||
    lower.includes('wipe all tasks')
  ) {
    return 'ACTION_DELETE_ALL_TASKS';
  }

  if (
    lower.includes('reset database') ||
    lower.includes('reset db') ||
    lower.includes('restore default') ||
    lower.includes('restore sample') ||
    lower.includes('reseed database') ||
    lower.includes('re-seed database')
  ) {
    return 'ACTION_RESET_DATABASE';
  }

  // 4. Bottlenecks / Critical alerts
  if (lower.includes('bottleneck') || (lower.includes('critical') && lower.includes('task'))) {
    return 'QUERY_BOTTLENECKS';
  }

  // 5. UI Actions: Theme / Navigation
  if (lower.includes('dark mode') || lower.includes('dark theme')) return 'ACTION_THEME_DARK';
  if (lower.includes('light mode') || lower.includes('light theme')) return 'ACTION_THEME_LIGHT';

  if (lower.match(/\b(go to|open|switch to|navigate to|take me to|show)\s+(the\s+)?(dashboard|projects|tasks|analysis|reports|reporting)\b/i)) {
    return 'ACTION_NAVIGATE';
  }

  // 6. Database Actions: Update / Delete / Create
  if (lower.match(/\b(mark|set|update)\s+(task\s+)?tsk-\d+/i)) return 'ACTION_UPDATE_TASK';
  if (lower.match(/\b(delete|remove)\s+(task\s+)?tsk-\d+/i)) return 'ACTION_DELETE_TASK';
  if (lower.match(/\b(add|create|new)\s+(a\s+)?([a-z\s-]+\s+)?task\b/i)) return 'ACTION_CREATE_TASK';
  if (lower.match(/\b(add|create|new)\s+(a\s+)?([a-z\s-]+\s+)?project\b/i)) return 'ACTION_CREATE_PROJECT';

  // 7. Questions / Analytical Queries
  if (/^(what|how|why|which|who|when|where|is there|are there|list|show)\b/i.test(lower)) {
    return 'DATABASE_QUERY';
  }

  // 8. General Conversational / Advice
  return 'GENERAL_CONVERSATION';
}

/**
 * Execute Direct Actions Deterministically
 */
async function executeAction(intent, prompt, dbData) {
  const p = prompt.trim();
  const lower = p.toLowerCase();
  const projects = dbData.projects || [];
  const tasks = dbData.tasks || [];

  if (intent === 'ACTION_CLEAR_DATABASE') {
    await db.clearDatabase();
    return {
      action: 'cleared_db',
      data: {},
      reply: "🗑️ **Complete database cleared.** All projects and sprint tasks have been removed from PostgreSQL.\n\n*Say **\"reset database\"** at any time to restore default portfolio data.*"
    };
  }

  if (intent === 'ACTION_DELETE_ALL_PROJECTS') {
    await db.deleteAllProjects();
    return {
      action: 'deleted_all_projects',
      data: {},
      reply: "🗑️ **All projects have been deleted** from PostgreSQL (along with associated sprint tasks).\n\n*Say **\"reset database\"** to restore default projects.*"
    };
  }

  if (intent === 'ACTION_DELETE_ALL_TASKS') {
    await db.deleteAllTasks();
    return {
      action: 'deleted_all_tasks',
      data: {},
      reply: "🗑️ **All sprint tasks have been deleted** from PostgreSQL.\n\n*Say **\"reset database\"** to restore default tasks.*"
    };
  }

  if (intent === 'ACTION_RESET_DATABASE') {
    await db.resetToDefaults();
    return {
      action: 'reset_db',
      data: {},
      reply: "✨ **Database restored to default portfolio state.** 6 strategic projects and 7 sprint tasks re-seeded into PostgreSQL."
    };
  }

  if (intent === 'ACTION_THEME_DARK') {
    return { action: 'theme', data: { mode: 'dark' }, reply: "Switched application theme to **Dark Mode**." };
  }
  if (intent === 'ACTION_THEME_LIGHT') {
    return { action: 'theme', data: { mode: 'light' }, reply: "Switched application theme to **Light Mode**." };
  }

  if (intent === 'ACTION_NAVIGATE') {
    const m = lower.match(/\b(dashboard|projects|tasks|analysis|reports|reporting)\b/i);
    let tab = (m ? m[1] : 'dashboard').toLowerCase();
    if (tab === 'reports' || tab === 'reporting') tab = 'analysis';
    return {
      action: 'navigate',
      data: { tab },
      reply: `Navigated to the **${tab.charAt(0).toUpperCase() + tab.slice(1)}** view.`
    };
  }

  if (intent === 'ACTION_UPDATE_TASK') {
    const statusMatch = lower.match(/\b(mark|set|update)\s+(task\s+)?(tsk-\d+)\s+(as|to)?\s*(done|complete|completed|in progress|todo|to do)\b/i);
    if (statusMatch) {
      const taskId = statusMatch[3].toUpperCase();
      let statusRaw = statusMatch[5].toLowerCase();
      let newStatus = 'In Progress';
      if (statusRaw.includes('done') || statusRaw.includes('complete')) newStatus = 'Done';
      if (statusRaw.includes('todo') || statusRaw.includes('to do')) newStatus = 'Todo';

      await db.updateTaskStatus(taskId, newStatus);
      return {
        action: 'updated_task',
        data: { id: taskId, status: newStatus },
        reply: `Task **${taskId}** has been marked as **${newStatus}** in PostgreSQL.`
      };
    }
  }

  if (intent === 'ACTION_DELETE_TASK') {
    const deleteMatch = lower.match(/\b(delete|remove)\s+(task\s+)?(tsk-\d+)\b/i);
    if (deleteMatch) {
      const taskId = deleteMatch[3].toUpperCase();
      await db.deleteTask(taskId);
      return {
        action: 'deleted_task',
        data: { id: taskId },
        reply: `Deleted task **${taskId}** from PostgreSQL.`
      };
    }
  }

  if (intent === 'ACTION_CREATE_TASK') {
    // Determine priority
    let priority = 'Medium';
    if (lower.includes('critical')) priority = 'Critical';
    else if (lower.includes('high')) priority = 'High';
    else if (lower.includes('low')) priority = 'Low';

    // Target project
    let targetProject = projects[0] || { id: 'PRJ-01', title: 'Alpha Redesign' };
    for (const proj of projects) {
      if (lower.includes(proj.title.toLowerCase()) || lower.includes(proj.id.toLowerCase())) {
        targetProject = proj;
        break;
      }
    }

    // Clean task title
    let taskTitle = p;
    // Strip project reference cleanly
    if (targetProject?.title) {
      const projRegex = new RegExp(`\\b(on|for)(\\s+project)?\\s+${targetProject.title}\\b`, 'i');
      taskTitle = taskTitle.replace(projRegex, '');
    }

    taskTitle = taskTitle
      .replace(/\b(please\s+)?(can\s+you\s+)?(add|create|new)\s+(a\s+)?([a-z\s-]+\s+)?task\b/i, '')
      .replace(/\bwith\s+(critical|high|medium|low)\s+priority\b/i, '')
      .replace(/\b(critical|high|medium|low)\s+priority\b/i, '')
      .replace(/\bpriority\s*:\s*(critical|high|medium|low)\b/i, '')
      .replace(/\bassigned\s+to\s+[a-zA-Z\s]+/i, '')
      .replace(/^\s*\bto\b\s+/i, '')
      .replace(/^[:\-–—\s]+/, '')
      .trim();

    if (!taskTitle || taskTitle.length < 3) {
      taskTitle = `New task for ${targetProject.title}`;
    }

    // Assignee
    let assignee = 'Sarah Chen';
    if (lower.includes('alex')) assignee = 'Alex Rivera';
    else if (lower.includes('david')) assignee = 'David Kim';
    else if (lower.includes('elena')) assignee = 'Elena Rostova';
    else if (lower.includes('marcus')) assignee = 'Marcus Vance';
    else if (lower.includes('priya')) assignee = 'Priya Patel';

    const newId = `TSK-${100 + (tasks.length || 0) + 1}`;
    const task = {
      id: newId,
      projectId: targetProject.id,
      title: taskTitle,
      description: `Task created via AI Copilot for ${targetProject.title}`,
      priority,
      status: 'Todo',
      assignee,
      assigneeAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
      dueDate: 'Next Sprint'
    };

    await db.saveTask(task);
    return {
      action: 'created_task',
      data: task,
      reply: `Created ${priority} priority task **"${taskTitle}"** on project **${targetProject.title}** (${targetProject.id}) assigned to ${assignee}.`
    };
  }

  if (intent === 'ACTION_CREATE_PROJECT') {
    let title = p
      .replace(/\b(please\s+)?(can\s+you\s+)?(add|create|new)\s+(a\s+)?project\b/i, '')
      .replace(/\bwith\s+\$?\d+k?\s+budget\b/i, '')
      .replace(/\b(called|named)\b/i, '')
      .replace(/^[:\-–—\s]+/, '')
      .trim();

    if (!title || title.length < 3 || title.toLowerCase() === 'project name') {
      title = 'New Strategic Project';
    }

    const budgetMatch = p.match(/\$(\d+[\d,]*k?)/i);
    const budget = budgetMatch ? `$${budgetMatch[1]}` : '$40,000';

    const newId = `PRJ-0${(projects.length || 0) + 1}`;
    const project = {
      id: newId,
      title,
      category: 'Enterprise Engineering',
      description: 'Strategic project roadmap initialized via AI Copilot.',
      status: 'In Progress',
      progress: 0,
      dueDate: 'Dec 31, 2026',
      lead: 'Sarah Chen',
      leadAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
      teamSize: 3,
      spent: '$0',
      budget,
      tag: 'Strategic Initiative'
    };

    await db.saveProject(project);
    return {
      action: 'created_project',
      data: project,
      reply: `Created project **"${title}"** (${newId}) with budget **${budget}** in PostgreSQL.`
    };
  }

  return null;
}

/**
 * Call Local Qwen 2.5 1.5B via Ollama for Conversational Generation
 */
async function callQwenLlm(systemPrompt, userPrompt, history = []) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history.slice(-4),
          { role: 'user', content: userPrompt }
        ]
      })
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return data.message?.content?.trim();
    }
  } catch (err) {
    console.warn('Ollama call failed or timed out:', err.message);
  }
  return null;
}

/**
 * Main AI Agent Message Processor
 */
async function processUserMessage(userPrompt, history = []) {
  const dbData = await db.getAllData();
  const status = await getAgentStatus();
  const intent = classifyIntent(userPrompt);

  // 1. Greetings
  if (intent === 'GREETING') {
    return {
      reply: `Hello! 👋 I'm your **ProjectCentral AI Copilot** (running locally with **Qwen 2.5 1.5B**). How can I assist you with your projects, tasks, or sprints today?`,
      model: 'Qwen 2.5 1.5B (Local)'
    };
  }

  // 2. Capabilities & Help
  if (intent === 'CAPABILITIES') {
    return {
      reply: `Here are the things I can do for you directly in **ProjectCentral**:

1. **Create & Assign Tasks**:
   - *"Add a task on Alpha Redesign with high priority to redesign navigation bar"*
   - *"Create low priority task on Cloud Migration to backup database"*

2. **Update & Complete Tasks**:
   - *"Mark task TSK-104 as Done"*
   - *"Set task TSK-103 to In Progress"*
   - *"Delete task TSK-108"*

3. **Manage Projects & Portfolios**:
   - *"Create project DevOps Migration with $60k budget"*
   - *"What projects do we have?"*

4. **Analyze Sprints & Bottlenecks**:
   - *"What are the critical bottlenecks?"*
   - *"How many tasks are in progress?"*

5. **Desktop Navigation & Theme**:
   - *"Go to Tasks view"* (or *Dashboard*, *Projects*, *Reporting*)
   - *"Switch to Dark Mode"* (or *Light Mode*)

All actions are saved directly to your **PostgreSQL** database!`,
      model: 'ProjectCentral Copilot'
    };
  }

  // 3. Critical Bottlenecks Query
  if (intent === 'QUERY_BOTTLENECKS') {
    const criticals = (dbData.tasks || []).filter(t => t.priority === 'Critical' || t.status !== 'Done');
    const overdue = criticals.filter(t => t.priority === 'Critical');
    return {
      reply: `Found **${overdue.length} critical priority tasks** in PostgreSQL:\n\n` +
        overdue.slice(0, 4).map(t => `- **${t.id}**: ${t.title} (*${t.status}*, assigned to ${t.assignee})`).join('\n') +
        `\n\nThe most urgent bottleneck is **${overdue[0]?.id || 'TSK-104'}**.`,
      action: 'info',
      model: 'ProjectCentral Copilot'
    };
  }

  // 4. Explicit Action Execution (Tasks, Projects, Theme, Nav)
  if (intent.startsWith('ACTION_')) {
    const actionResult = await executeAction(intent, userPrompt, dbData);
    if (actionResult) {
      return {
        reply: actionResult.reply,
        action: actionResult.action,
        data: actionResult.data,
        model: 'Qwen 2.5 1.5B (Fast Copilot)'
      };
    }
  }

  // 5. Database Queries & Questions (handled by Qwen with real DB context)
  if (intent === 'DATABASE_QUERY' && status.online && status.installed) {
    const systemPrompt = `You are ProjectCentral AI Copilot. Answer questions accurately based on this project data:
Projects (${dbData.projects.length}): ${JSON.stringify(dbData.projects.map(p => ({ id: p.id, title: p.title, status: p.status, progress: p.progress, budget: p.budget, lead: p.lead })))}
Tasks (${dbData.tasks.length}): ${JSON.stringify(dbData.tasks.map(t => ({ id: t.id, project_id: t.projectId, title: t.title, priority: t.priority, status: t.status, assignee: t.assignee })))}

Rules:
- Give a concise, helpful summary.
- Format with markdown bullet points.
- Do NOT perform any database creation or deletion. Answer the question directly.`;

    const llmReply = await callQwenLlm(systemPrompt, userPrompt, history);
    if (llmReply) {
      return {
        reply: llmReply,
        model: 'Qwen 2.5 1.5B (Ollama Local)'
      };
    }
  }

  // 6. General Conversational / Advice (Agile, Scrum, Planning, etc.)
  if (status.online && status.installed) {
    const systemPrompt = `You are ProjectCentral AI Copilot, an expert enterprise project manager and technical advisor.
Provide insightful, structured, and practical advice on project management, agile workflows, and sprint planning.`;

    const llmReply = await callQwenLlm(systemPrompt, userPrompt, history);
    if (llmReply) {
      return {
        reply: llmReply,
        model: 'Qwen 2.5 1.5B (Ollama Local)'
      };
    }
  }

  // 7. General Fallback
  return {
    reply: `I'm here to help manage your projects and sprint tasks! You can instruct me to:
- *"Add a task on Alpha Redesign with high priority"*
- *"Mark task TSK-104 as Done"*
- *"What projects do we have?"*
- *"Show critical bottlenecks"*`,
    model: 'ProjectCentral Copilot'
  };
}

module.exports = {
  getAgentStatus,
  pullModel,
  processUserMessage,
  OLLAMA_HOST,
  DEFAULT_MODEL
};
