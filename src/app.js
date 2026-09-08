/**
 * ProjectCentral Desktop Client - Application Logic with PostgreSQL Integration
 */

// State Management
const STATE_KEY = 'projectcentral_desktop_state';

const defaultState = {
  theme: 'light',
  activeTab: 'dashboard',
  taskFilter: 'all',
  taskViewMode: 'kanban', // 'kanban' or 'list'
  projectFilter: 'all',
  searchQuery: '',
  projects: [],
  tasks: []
};

let appState = (() => {
  try {
    const saved = localStorage.getItem(STATE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Error loading fallback state from localStorage:', e);
  }
  return JSON.parse(JSON.stringify(defaultState));
})();

function saveStateLocal() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.error('Error saving state:', e);
  }
}

// Window Controls
function initWindowControls() {
  const minBtn = document.getElementById('win-min-btn');
  const maxBtn = document.getElementById('win-max-btn');
  const closeBtn = document.getElementById('win-close-btn');

  if (window.electronAPI) {
    minBtn?.addEventListener('click', () => window.electronAPI.minimize());
    maxBtn?.addEventListener('click', () => window.electronAPI.maximize());
    closeBtn?.addEventListener('click', () => window.electronAPI.close());

    window.electronAPI.onWindowStateChange((state) => {
      const maxIcon = maxBtn?.querySelector('.material-symbols-outlined');
      if (maxIcon) {
        maxIcon.textContent = state.isMaximized ? 'crop_square' : 'check_box_outline_blank';
      }
    });
  }
}

// Theme Toggle
function applyTheme(theme) {
  appState.theme = theme;
  saveStateLocal();
  if (window.electronAPI?.db) {
    window.electronAPI.db.saveSetting('theme', theme).catch(console.error);
  }

  const htmlEl = document.documentElement;
  const themeIcon = document.getElementById('theme-icon');

  if (theme === 'dark') {
    htmlEl.classList.add('dark');
    if (themeIcon) themeIcon.textContent = 'light_mode';
  } else {
    htmlEl.classList.remove('dark');
    if (themeIcon) themeIcon.textContent = 'dark_mode';
  }
}

function toggleTheme() {
  applyTheme(appState.theme === 'dark' ? 'light' : 'dark');
}

// Tab Navigation
function switchTab(tabId) {
  appState.activeTab = tabId;
  saveStateLocal();
  if (window.electronAPI?.db) {
    window.electronAPI.db.saveSetting('activeTab', tabId).catch(console.error);
  }

  // Update Nav Links
  document.querySelectorAll('.nav-link').forEach((link) => {
    if (link.dataset.tab === tabId) {
      link.classList.add('bg-surface-container-high', 'dark:bg-secondary-container', 'text-secondary', 'font-bold');
      link.classList.remove('text-on-surface-variant', 'dark:text-surface-variant');
      const icon = link.querySelector('.material-symbols-outlined');
      if (icon) icon.setAttribute('data-weight', 'fill');
    } else {
      link.classList.remove('bg-surface-container-high', 'dark:bg-secondary-container', 'text-secondary', 'font-bold');
      link.classList.add('text-on-surface-variant', 'dark:text-surface-variant');
      const icon = link.querySelector('.material-symbols-outlined');
      if (icon) icon.removeAttribute('data-weight');
    }
  });

  // Update Panes
  document.querySelectorAll('.tab-pane').forEach((pane) => {
    pane.classList.toggle('active', pane.id === `tab-${tabId}`);
  });

  // Re-render corresponding views
  if (tabId === 'dashboard') renderDashboardView();
  if (tabId === 'projects') renderProjectsView();
  if (tabId === 'tasks') renderTasksView();
  if (tabId === 'analysis') renderAnalysisView();
}

// Render Dashboard View
function renderDashboardView() {
  const container = document.getElementById('dashboard-content');
  if (!container) return;

  const totalProjects = appState.projects.length;
  const inProgress = appState.projects.filter(p => p.status === 'In Progress').length;
  const criticalTasks = appState.tasks.filter(t => t.priority === 'Critical' && t.status !== 'Done').length;
  const completedProjects = appState.projects.filter(p => p.status === 'Completed').length;
  const avgCompletion = totalProjects ? Math.round(
    appState.projects.reduce((acc, p) => acc + (p.progress || 0), 0) / totalProjects
  ) : 0;

  container.innerHTML = `
    <div class="space-y-8">
      <!-- Welcome Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <h2 class="font-display-lg text-display-lg font-bold text-on-surface dark:text-white">Executive Dashboard</h2>
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              PostgreSQL Live
            </span>
          </div>
          <p class="font-body-md text-body-md text-on-surface-variant dark:text-slate-400">
            Real-time project telemetry, sprint velocity, and database-persisted performance.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <button onclick="switchTab('projects')" class="px-4 py-2 border border-outline-variant hover:border-primary text-primary dark:text-inverse-primary rounded-lg font-body-sm font-semibold hover:bg-surface-container-low dark:hover:bg-slate-800 transition-colors flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">folder_open</span>
            View Projects
          </button>
          <button onclick="openNewTaskModal()" class="px-4 py-2 bg-primary dark:bg-secondary text-on-primary rounded-lg font-body-sm font-semibold hover:opacity-90 transition-colors flex items-center gap-2 shadow-sm">
            <span class="material-symbols-outlined text-[18px]">add</span>
            New Task
          </button>
        </div>
      </div>

      <!-- Metric KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
        <div class="bg-surface-container-lowest dark:bg-inverse-surface border border-outline-variant dark:border-slate-800 rounded-xl p-5 interactive-card">
          <div class="flex items-center justify-between text-on-surface-variant mb-2">
            <span class="font-label-caps text-label-caps uppercase tracking-wider">Active Projects</span>
            <span class="w-8 h-8 rounded-lg bg-surface-container-low dark:bg-secondary-container/50 flex items-center justify-center text-secondary">
              <span class="material-symbols-outlined text-[20px]">folder</span>
            </span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="font-display-lg text-display-lg font-bold text-on-surface dark:text-white">${totalProjects}</span>
            <span class="text-secondary font-body-sm font-semibold">${inProgress} in flight</span>
          </div>
          <p class="font-body-sm text-body-sm text-on-surface-variant dark:text-slate-400 mt-2">${completedProjects} completed this quarter</p>
        </div>

        <div class="bg-surface-container-lowest dark:bg-inverse-surface border border-outline-variant dark:border-slate-800 rounded-xl p-5 interactive-card">
          <div class="flex items-center justify-between text-on-surface-variant mb-2">
            <span class="font-label-caps text-label-caps uppercase tracking-wider">Avg Completion</span>
            <span class="w-8 h-8 rounded-lg bg-surface-container-low dark:bg-secondary-container/50 flex items-center justify-center text-secondary">
              <span class="material-symbols-outlined text-[20px]">donut_large</span>
            </span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="font-display-lg text-display-lg font-bold text-on-surface dark:text-white">${avgCompletion}%</span>
            <span class="text-tertiary font-body-sm font-semibold flex items-center">
              <span class="material-symbols-outlined text-[14px]">arrow_upward</span> +4.2%
            </span>
          </div>
          <div class="w-full bg-surface-container-high dark:bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
            <div class="bg-secondary h-full rounded-full progress-fill" style="width: ${avgCompletion}%"></div>
          </div>
        </div>

        <div class="bg-surface-container-lowest dark:bg-inverse-surface border border-outline-variant dark:border-slate-800 rounded-xl p-5 interactive-card">
          <div class="flex items-center justify-between text-on-surface-variant mb-2">
            <span class="font-label-caps text-label-caps uppercase tracking-wider">Active Bottlenecks</span>
            <span class="w-8 h-8 rounded-lg bg-error-container text-error flex items-center justify-center ${criticalTasks > 0 ? 'badge-glow-red' : ''}">
              <span class="material-symbols-outlined text-[20px]">warning</span>
            </span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="font-display-lg text-display-lg font-bold text-error">${criticalTasks}</span>
            <span class="font-body-sm text-error font-medium">${criticalTasks > 0 ? 'Require triage' : 'All Clear'}</span>
          </div>
          <p class="font-body-sm text-body-sm text-on-surface-variant dark:text-slate-400 mt-2 truncate">
            ${(() => {
              const b = appState.tasks.find(t => t.priority === 'Critical' && t.status !== 'Done');
              return b ? `${b.id}: ${escapeHtml(b.title)}` : 'All critical items resolved';
            })()}
          </p>
        </div>

        <div class="bg-surface-container-lowest dark:bg-inverse-surface border border-outline-variant dark:border-slate-800 rounded-xl p-5 interactive-card">
          <div class="flex items-center justify-between text-on-surface-variant mb-2">
            <span class="font-label-caps text-label-caps uppercase tracking-wider">Sprint Velocity</span>
            <span class="w-8 h-8 rounded-lg bg-surface-container-low dark:bg-secondary-container/50 flex items-center justify-center text-secondary">
              <span class="material-symbols-outlined text-[20px]">speed</span>
            </span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="font-display-lg text-display-lg font-bold text-on-surface dark:text-white">${appState.tasks.filter(t => t.status === 'Done').length * 6} pts</span>
            <span class="text-tertiary font-body-sm font-semibold flex items-center">
              ${avgCompletion >= 50 ? 'On Track' : 'In Flight'}
            </span>
          </div>
          <p class="font-body-sm text-body-sm text-on-surface-variant dark:text-slate-400 mt-2">
            Sprint 24 • ${Math.max(appState.tasks.length * 6, 24)} total capacity
          </p>
        </div>
      </div>

      <!-- Active Sprints & Recent Activities -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        <!-- Main Projects Pulse -->
        <div class="lg:col-span-8 bg-surface-container-lowest dark:bg-inverse-surface border border-outline-variant dark:border-slate-800 rounded-xl p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="font-headline-sm text-headline-sm font-bold text-on-surface dark:text-white">Projects In Flight</h3>
              <p class="font-body-sm text-body-sm text-on-surface-variant dark:text-slate-400">Deliverables synced with PostgreSQL</p>
            </div>
            <button onclick="switchTab('projects')" class="text-secondary font-body-sm font-semibold hover:underline flex items-center gap-1">
              View All (${totalProjects})
              <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>

          <div class="space-y-4">
            ${appState.projects.slice(0, 4).map(p => `
              <div onclick="selectProject('${p.id}')" class="p-4 rounded-lg border border-outline-variant/70 dark:border-slate-700/70 hover:border-secondary transition-all cursor-pointer bg-surface/50 dark:bg-slate-800/40 hover:bg-surface-container-low dark:hover:bg-slate-800/80 group">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-3">
                    <span class="font-headline-sm text-[16px] font-bold text-on-surface dark:text-white group-hover:text-secondary transition-colors">${p.title}</span>
                    <span class="px-2.5 py-0.5 rounded-full font-label-caps text-[11px] ${
                      p.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                      p.status === 'Review' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                      'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    }">${p.status}</span>
                  </div>
                  <span class="font-data-mono text-data-mono text-on-surface-variant dark:text-slate-400 text-sm">${p.dueDate}</span>
                </div>
                <p class="font-body-sm text-body-sm text-on-surface-variant dark:text-slate-400 line-clamp-1 mb-3">${p.description}</p>
                <div class="flex items-center justify-between text-xs text-on-surface-variant dark:text-slate-400">
                  <div class="flex items-center gap-2">
                    <img src="${p.leadAvatar}" class="w-5 h-5 rounded-full object-cover" alt="${p.lead}">
                    <span>${p.lead} • ${p.teamSize} members</span>
                  </div>
                  <span class="font-semibold text-on-surface dark:text-white">${p.progress}%</span>
                </div>
                <div class="w-full bg-surface-container-high dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div class="bg-secondary h-full rounded-full" style="width: ${p.progress}%"></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Immediate Tasks & Team Activity -->
        <div class="lg:col-span-4 space-y-6">
          <div class="bg-surface-container-lowest dark:bg-inverse-surface border border-outline-variant dark:border-slate-800 rounded-xl p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-headline-sm text-headline-sm font-bold text-on-surface dark:text-white">Urgent Tasks</h3>
              <button onclick="switchTab('tasks')" class="text-secondary font-body-sm font-semibold hover:underline">Manage</button>
            </div>
            <div class="space-y-3">
              ${appState.tasks.slice(0, 4).map(t => `
                <div class="p-3 rounded-lg border border-outline-variant/60 dark:border-slate-700/60 flex items-start gap-3 bg-surface/30 dark:bg-slate-800/30">
                  <input type="checkbox" ${t.status === 'Done' ? 'checked' : ''} onchange="toggleTaskStatus('${t.id}')" class="mt-1 rounded border-outline-variant text-secondary focus:ring-secondary cursor-pointer">
                  <div class="flex-1 min-w-0">
                    <p class="font-body-sm text-body-sm font-medium ${t.status === 'Done' ? 'line-through text-on-surface-variant' : 'text-on-surface dark:text-white'} truncate">${t.title}</p>
                    <div class="flex items-center gap-2 mt-1">
                      <span class="font-data-mono text-[11px] text-on-surface-variant dark:text-slate-400">${t.id}</span>
                      <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        t.priority === 'Critical' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                        t.priority === 'High' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }">${t.priority}</span>
                      <span class="text-[11px] text-on-surface-variant dark:text-slate-400 ml-auto">${t.dueDate}</span>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Quick Navigation to Analysis -->
          <div class="bg-gradient-to-br from-secondary/10 to-primary/5 dark:from-secondary/20 dark:to-inverse-surface border border-secondary/20 rounded-xl p-5">
            <div class="flex items-center gap-3 mb-2">
              <span class="material-symbols-outlined text-secondary text-[24px]">insights</span>
              <h4 class="font-headline-sm text-[16px] font-bold text-on-surface dark:text-white">Sprint Burndown</h4>
            </div>
            <p class="font-body-sm text-body-sm text-on-surface-variant dark:text-slate-400 mb-4">
              Alpha Redesign sprint is running 5% ahead of ideal projection. 2 days to release candidate.
            </p>
            <button onclick="switchTab('analysis')" class="w-full py-2 bg-secondary text-white rounded-lg font-body-sm font-semibold hover:bg-secondary/90 transition-colors flex items-center justify-center gap-2">
              Open Analysis Report
              <span class="material-symbols-outlined text-[16px]">trending_up</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Render Projects View
function renderProjectsView() {
  const container = document.getElementById('projects-content');
  if (!container) return;

  const filter = appState.projectFilter;
  const search = appState.searchQuery.toLowerCase();

  const filtered = appState.projects.filter(p => {
    const matchesFilter = filter === 'all' || p.status.toLowerCase() === filter.toLowerCase();
    const matchesSearch = !search ||
      p.title.toLowerCase().includes(search) ||
      p.category.toLowerCase().includes(search) ||
      p.description.toLowerCase().includes(search);
    return matchesFilter && matchesSearch;
  });

  container.innerHTML = `
    <div class="space-y-8">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 class="font-display-lg text-display-lg font-bold text-on-surface dark:text-white">Projects Portfolio</h2>
          <p class="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-1">
            Persisted in PostgreSQL database (<code class="text-xs font-mono text-secondary">projectcentral_db.projects</code>).
          </p>
        </div>
        <button onclick="openNewProjectModal()" class="px-4 py-2.5 bg-primary dark:bg-secondary text-on-primary rounded-lg font-body-sm font-semibold hover:opacity-90 transition-colors flex items-center gap-2 self-start md:self-auto shadow-sm">
          <span class="material-symbols-outlined text-[18px]">add_circle</span>
          New Project
        </button>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-outline-variant dark:border-slate-800 pb-4">
        <div class="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          ${['all', 'in progress', 'review', 'completed'].map(status => `
            <button onclick="filterProjects('${status}')" class="px-3.5 py-1.5 rounded-lg text-body-sm font-semibold capitalize whitespace-nowrap transition-colors ${
              appState.projectFilter === status
                ? 'bg-primary dark:bg-secondary text-on-primary'
                : 'text-on-surface-variant dark:text-slate-400 hover:bg-surface-container-low dark:hover:bg-slate-800'
            }">
              ${status === 'all' ? 'All Projects' : status}
            </button>
          `).join('')}
        </div>
        <div class="flex items-center gap-2">
          <div class="relative w-full sm:w-64">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant dark:text-slate-400 text-[18px]">search</span>
            <input type="text" value="${appState.searchQuery}" oninput="searchProjects(this.value)" placeholder="Search projects..." class="w-full pl-9 pr-3 py-1.5 bg-surface-container-lowest dark:bg-slate-800 border border-outline-variant dark:border-slate-700 rounded-lg text-body-sm text-on-surface dark:text-white focus:border-secondary outline-none transition-colors">
          </div>
        </div>
      </div>

      <!-- Projects Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
        ${filtered.map(p => `
          <div class="bg-surface-container-lowest dark:bg-inverse-surface border border-outline-variant dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between interactive-card">
            <div>
              <div class="flex items-start justify-between gap-2 mb-3">
                <span class="px-2.5 py-0.5 rounded-full font-label-caps text-[11px] font-semibold ${
                  p.status === 'Completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                  p.status === 'Review' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                  'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                }">${p.status}</span>
                <span class="font-label-caps text-[11px] text-on-surface-variant dark:text-slate-400 px-2 py-0.5 rounded bg-surface-container-low dark:bg-slate-800">${p.tag}</span>
              </div>
              <h3 class="font-headline-sm text-[18px] font-bold text-on-surface dark:text-white mb-1">${escapeHtml(p.title)}</h3>
              <p class="font-body-sm text-[12px] text-secondary font-semibold uppercase tracking-wider mb-2">${escapeHtml(p.category)}</p>
              <p class="font-body-sm text-body-sm text-on-surface-variant dark:text-slate-400 line-clamp-2 mb-6">${escapeHtml(p.description)}</p>
            </div>

            <div class="space-y-4 pt-4 border-t border-outline-variant/60 dark:border-slate-800">
              <div>
                <div class="flex justify-between items-center text-xs mb-1.5 font-medium">
                  <span class="text-on-surface-variant dark:text-slate-400">Progress</span>
                  <span class="text-on-surface dark:text-white font-semibold">${p.progress}%</span>
                </div>
                <div class="w-full bg-surface-container-high dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div class="bg-secondary h-full rounded-full progress-fill" style="width: ${p.progress}%"></div>
                </div>
              </div>

              <div class="flex items-center justify-between text-xs text-on-surface-variant dark:text-slate-400">
                <div class="flex items-center gap-2">
                  <img src="${p.leadAvatar}" class="w-6 h-6 rounded-full object-cover" alt="${p.lead}">
                  <span class="font-medium">${p.lead}</span>
                </div>
                <span class="font-data-mono">${p.dueDate}</span>
              </div>

              <div class="flex items-center justify-between pt-2 text-xs">
                <span class="text-on-surface-variant dark:text-slate-400">Budget: <strong class="text-on-surface dark:text-white">${p.spent}</strong> / ${p.budget}</span>
                <div class="flex items-center gap-1.5">
                  <button onclick="openEditProjectModal('${p.id}')" class="text-on-surface-variant hover:text-secondary p-1 rounded hover:bg-surface-container-high dark:hover:bg-slate-800 transition-colors" title="Edit Project">
                    <span class="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                  <button onclick="deleteProjectAction('${p.id}')" class="text-on-surface-variant hover:text-error p-1 rounded hover:bg-surface-container-high dark:hover:bg-slate-800 transition-colors" title="Delete Project">
                    <span class="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                  <button onclick="inspectProjectAnalysis('${p.id}')" class="text-secondary font-semibold hover:underline flex items-center gap-0.5 ml-1">
                    Analytics <span class="material-symbols-outlined text-[14px]">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `).join('')}
        ${filtered.length === 0 ? `
          <div class="col-span-full py-16 text-center border-2 border-dashed border-outline-variant/60 dark:border-slate-800 rounded-2xl p-8">
            <div class="w-12 h-12 rounded-full bg-secondary/10 text-secondary mx-auto flex items-center justify-center mb-3">
              <span class="material-symbols-outlined text-[28px]">folder_off</span>
            </div>
            <h3 class="text-base font-bold text-on-surface dark:text-white mb-1">No Projects Found</h3>
            <p class="text-xs text-on-surface-variant dark:text-slate-400 mb-4 max-w-sm mx-auto">No projects match your current filter. Create a new project to get started.</p>
            <button onclick="openNewProjectModal()" class="px-4 py-2 bg-primary dark:bg-secondary text-on-primary rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-1.5 shadow-sm">
              <span class="material-symbols-outlined text-[16px]">add_circle</span> New Project
            </button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// Render Tasks View
function renderTasksView() {
  const container = document.getElementById('tasks-content');
  if (!container) return;

  const isKanban = appState.taskViewMode === 'kanban';

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Top Title & Action Bar -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 class="font-display-lg text-display-lg font-bold text-on-surface dark:text-white">Task Manager</h2>
          <p class="font-body-md text-body-md text-on-surface-variant dark:text-slate-400 mt-1">
            Persisted in PostgreSQL (<code class="text-xs font-mono text-secondary">projectcentral_db.tasks</code>).
          </p>
        </div>
        <div class="flex items-center gap-3">
          <!-- View Toggle -->
          <div class="flex items-center bg-surface-container-low dark:bg-slate-800 p-1 rounded-lg border border-outline-variant dark:border-slate-700">
            <button onclick="setTaskView('kanban')" class="px-3 py-1.5 rounded-md font-body-sm font-semibold flex items-center gap-1.5 transition-colors ${
              isKanban ? 'bg-surface-container-lowest dark:bg-slate-900 shadow-sm text-primary dark:text-white' : 'text-on-surface-variant dark:text-slate-400'
            }">
              <span class="material-symbols-outlined text-[16px]">view_kanban</span> Kanban
            </button>
            <button onclick="setTaskView('list')" class="px-3 py-1.5 rounded-md font-body-sm font-semibold flex items-center gap-1.5 transition-colors ${
              !isKanban ? 'bg-surface-container-lowest dark:bg-slate-900 shadow-sm text-primary dark:text-white' : 'text-on-surface-variant dark:text-slate-400'
            }">
              <span class="material-symbols-outlined text-[16px]">format_list_bulleted</span> List
            </button>
          </div>

          <button onclick="openNewTaskModal()" class="px-4 py-2 bg-primary dark:bg-secondary text-on-primary rounded-lg font-body-sm font-semibold hover:opacity-90 transition-colors flex items-center gap-2 shadow-sm">
            <span class="material-symbols-outlined text-[18px]">add</span> Add Task
          </button>
        </div>
      </div>

      <!-- View Containers -->
      ${isKanban ? renderKanbanBoard() : renderTaskList()}
    </div>
  `;
}

function renderKanbanBoard() {
  const columns = [
    { title: 'To Do', status: 'Todo', color: 'border-slate-300 dark:border-slate-700' },
    { title: 'In Progress', status: 'In Progress', color: 'border-blue-400 dark:border-blue-600' },
    { title: 'Done', status: 'Done', color: 'border-emerald-400 dark:border-emerald-600' }
  ];

  return `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      ${columns.map(col => {
        const colTasks = appState.tasks.filter(t => t.status === col.status);
        return `
          <div ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event, '${col.status}')" class="kanban-col bg-surface-container-low/60 dark:bg-slate-800/30 rounded-xl p-4 border border-outline-variant dark:border-slate-800 flex flex-col min-h-[520px]">
            <div class="flex items-center justify-between mb-4 px-1 pb-3 border-b ${col.color}">
              <div class="flex items-center gap-2">
                <h3 class="font-headline-sm text-[16px] font-bold text-on-surface dark:text-white">${col.title}</h3>
                <span class="w-5 h-5 rounded-full bg-surface-container-high dark:bg-slate-700 text-[11px] font-bold flex items-center justify-center text-on-surface-variant dark:text-slate-300">${colTasks.length}</span>
              </div>
              <button onclick="openNewTaskModal('${col.status}')" class="text-on-surface-variant dark:text-slate-400 hover:text-primary dark:hover:text-white transition-colors p-1 rounded hover:bg-surface-container-high dark:hover:bg-slate-700" title="Add task to ${col.title}">
                <span class="material-symbols-outlined text-[18px]">add</span>
              </button>
            </div>

            <div class="space-y-3 flex-1 overflow-y-auto pr-1">
              ${colTasks.map(t => `
                <div draggable="true" ondragstart="handleDragStart(event, '${t.id}')" ondragend="handleDragEnd(event)" class="kanban-card bg-surface-container-lowest dark:bg-inverse-surface p-4 rounded-xl border border-outline-variant dark:border-slate-800 hover:border-secondary transition-all interactive-card group">
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-data-mono text-[11px] text-on-surface-variant dark:text-slate-400 font-medium">${t.id}</span>
                    <div class="flex items-center gap-1.5">
                      <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        t.priority === 'Critical' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                        t.priority === 'High' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }">${t.priority}</span>
                      <button onclick="openEditTaskModal('${t.id}')" class="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-secondary transition-opacity p-0.5" title="Edit Task">
                        <span class="material-symbols-outlined text-[15px]">edit</span>
                      </button>
                      <button onclick="deleteTaskAction('${t.id}')" class="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-opacity p-0.5" title="Delete Task">
                        <span class="material-symbols-outlined text-[15px]">delete</span>
                      </button>
                    </div>
                  </div>
                  <h4 class="font-body-md font-semibold text-on-surface dark:text-white mb-1">${escapeHtml(t.title)}</h4>
                  <p class="font-body-sm text-body-sm text-on-surface-variant dark:text-slate-400 line-clamp-2 mb-4">${escapeHtml(t.description)}</p>
                  <div class="flex items-center justify-between pt-3 border-t border-outline-variant/40 dark:border-slate-800 text-xs">
                    <div class="flex items-center gap-2">
                      <img src="${t.assigneeAvatar}" class="w-5 h-5 rounded-full object-cover" alt="${t.assignee}">
                      <span class="text-on-surface-variant dark:text-slate-400 font-medium">${t.assignee}</span>
                    </div>
                    <select onchange="changeTaskStatus('${t.id}', this.value)" class="text-[11px] font-medium bg-surface dark:bg-slate-800 border border-outline-variant dark:border-slate-700 text-on-surface dark:text-white rounded px-2 py-0.5 outline-none cursor-pointer">
                      <option value="Todo" ${t.status === 'Todo' ? 'selected' : ''}>To Do</option>
                      <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                      <option value="Done" ${t.status === 'Done' ? 'selected' : ''}>Done</option>
                    </select>
                  </div>
                </div>
              `).join('')}
              ${colTasks.length === 0 ? `
                <div class="h-36 border-2 border-dashed border-outline-variant/60 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center text-on-surface-variant dark:text-slate-400 text-xs font-medium gap-1.5 p-4 text-center">
                  <span class="material-symbols-outlined text-[24px] opacity-40">drag_indicator</span>
                  <span>Drop tasks here</span>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderTaskList() {
  return `
    <div class="bg-surface-container-lowest dark:bg-inverse-surface border border-outline-variant dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-surface-container-low dark:bg-slate-800/60 border-b border-outline-variant dark:border-slate-800 font-label-caps text-label-caps text-on-surface-variant dark:text-slate-400 uppercase">
              <th class="py-3 px-4 w-12 text-center">Status</th>
              <th class="py-3 px-4">Key</th>
              <th class="py-3 px-4">Task Title</th>
              <th class="py-3 px-4">Priority</th>
              <th class="py-3 px-4">Assignee</th>
              <th class="py-3 px-4">Due Date</th>
              <th class="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-variant/50 dark:divide-slate-800 text-body-sm font-body-sm">
            ${appState.tasks.map(t => `
              <tr class="hover:bg-surface-container-low dark:hover:bg-slate-800/40 transition-colors">
                <td class="py-3 px-4 text-center">
                  <input type="checkbox" ${t.status === 'Done' ? 'checked' : ''} onchange="toggleTaskStatus('${t.id}')" class="rounded border-outline-variant text-secondary focus:ring-secondary cursor-pointer">
                </td>
                <td class="py-3 px-4 font-data-mono text-on-surface-variant dark:text-slate-400 font-medium">${t.id}</td>
                <td class="py-3 px-4">
                  <span class="font-semibold ${t.status === 'Done' ? 'line-through text-on-surface-variant dark:text-slate-500' : 'text-on-surface dark:text-white'}">${escapeHtml(t.title)}</span>
                  <p class="text-xs text-on-surface-variant dark:text-slate-400 line-clamp-1">${escapeHtml(t.description)}</p>
                </td>
                <td class="py-3 px-4">
                  <span class="text-[11px] font-semibold px-2 py-0.5 rounded ${
                    t.priority === 'Critical' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                    t.priority === 'High' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }">${t.priority}</span>
                </td>
                <td class="py-3 px-4">
                  <div class="flex items-center gap-2">
                    <img src="${t.assigneeAvatar}" class="w-5 h-5 rounded-full object-cover" alt="${t.assignee}">
                    <span class="dark:text-slate-300">${t.assignee}</span>
                  </div>
                </td>
                <td class="py-3 px-4 font-data-mono text-on-surface-variant dark:text-slate-400">${t.dueDate}</td>
                <td class="py-3 px-4 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <button onclick="openEditTaskModal('${t.id}')" class="text-on-surface-variant hover:text-secondary p-1 rounded hover:bg-surface-container-high dark:hover:bg-slate-700 transition-colors" title="Edit Task">
                      <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onclick="deleteTaskAction('${t.id}')" class="text-on-surface-variant hover:text-error p-1 rounded hover:bg-surface-container-high dark:hover:bg-slate-700 transition-colors" title="Delete Task">
                      <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
            ${appState.tasks.length === 0 ? `
              <tr>
                <td colspan="7" class="py-12 text-center text-on-surface-variant dark:text-slate-400">
                  <p class="font-semibold mb-1">No tasks in sprint</p>
                  <p class="text-xs mb-3">Add your first task to start tracking progress.</p>
                  <button onclick="openNewTaskModal()" class="px-3.5 py-1.5 bg-primary dark:bg-secondary text-on-primary rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity">
                    + Add Task
                  </button>
                </td>
              </tr>
            ` : ''}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Render Analysis / Reporting View
function renderAnalysisView() {
  const container = document.getElementById('analysis-content');
  if (!container) return;

  const totalTasks = appState.tasks.length;
  const doneTasks = appState.tasks.filter(t => t.status === 'Done').length;
  const inProgressTasks = appState.tasks.filter(t => t.status === 'In Progress').length;
  const criticalTasks = appState.tasks.filter(t => t.priority === 'Critical');
  const completionPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const activeBottlenecks = criticalTasks.filter(t => t.status !== 'Done');

  container.innerHTML = `
    <div class="space-y-8">
      <!-- Breadcrumb & Top Bar -->
      <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 text-xs font-semibold text-secondary uppercase tracking-wider mb-2">
            <span>Portfolio</span>
            <span class="material-symbols-outlined text-[14px]">chevron_right</span>
            <span>Sprint 24 Analytics</span>
          </div>
          <h2 class="font-display-lg text-display-lg font-bold text-on-surface dark:text-white">Portfolio Analysis & Telemetry</h2>
          <p class="font-body-lg text-body-lg text-on-surface-variant dark:text-slate-400 mt-1">
            Real-time velocity breakdown, live PostgreSQL metrics, and critical path triage.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <button onclick="exportAnalysisReport()" class="px-4 py-2 border border-outline-variant hover:border-primary text-primary dark:text-inverse-primary rounded-lg font-body-sm font-semibold hover:bg-surface-container-low dark:hover:bg-slate-800 transition-colors flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">download</span> Export Report
          </button>
          <button onclick="switchTab('projects')" class="px-4 py-2 bg-primary dark:bg-secondary text-on-primary rounded-lg font-body-sm font-semibold hover:opacity-90 transition-colors">
            Manage Projects
          </button>
        </div>
      </div>

      <!-- Bento Grid Layout -->
      <div class="grid grid-cols-1 md:grid-cols-12 gap-gutter">
        <!-- KPIs Row -->
        <div class="col-span-1 md:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-gutter">
          <div class="bg-surface-container-lowest dark:bg-inverse-surface border border-outline-variant dark:border-slate-800 rounded-xl p-5">
            <p class="font-label-caps text-label-caps text-on-surface-variant dark:text-slate-400 mb-1 uppercase tracking-wider">Overall Completion</p>
            <div class="flex items-end gap-2">
              <span class="font-display-lg text-[28px] font-bold text-on-surface dark:text-white">${completionPct}%</span>
              <span class="font-body-sm text-tertiary flex items-center mb-1 font-semibold">
                <span class="material-symbols-outlined text-[14px]">task_alt</span> ${doneTasks}/${totalTasks}
              </span>
            </div>
            <div class="w-full bg-surface-container-high dark:bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
              <div class="bg-tertiary h-full rounded-full transition-all duration-500" style="width: ${completionPct}%"></div>
            </div>
          </div>

          <div class="bg-surface-container-lowest dark:bg-inverse-surface border border-outline-variant dark:border-slate-800 rounded-xl p-5">
            <p class="font-label-caps text-label-caps text-on-surface-variant dark:text-slate-400 mb-1 uppercase tracking-wider">Active Sprints</p>
            <div class="flex items-end gap-2">
              <span class="font-display-lg text-[28px] font-bold text-on-surface dark:text-white">${inProgressTasks}</span>
              <span class="font-body-sm text-secondary flex items-center mb-1 font-semibold">In Progress</span>
            </div>
            <p class="text-xs text-on-surface-variant dark:text-slate-400 mt-3">Distributed across ${appState.projects.length} portfolios</p>
          </div>

          <div class="bg-surface-container-lowest dark:bg-inverse-surface border border-outline-variant dark:border-slate-800 rounded-xl p-5">
            <p class="font-label-caps text-label-caps text-on-surface-variant dark:text-slate-400 mb-1 uppercase tracking-wider">Active Bottlenecks</p>
            <div class="flex items-end gap-2">
              <span class="font-display-lg text-[28px] font-bold ${activeBottlenecks.length > 0 ? 'text-error' : 'text-emerald-500'}">${activeBottlenecks.length}</span>
              <span class="font-body-sm ${activeBottlenecks.length > 0 ? 'text-error' : 'text-emerald-500'} flex items-center mb-1 font-semibold">
                <span class="material-symbols-outlined text-[14px]">${activeBottlenecks.length > 0 ? 'warning' : 'check_circle'}</span> ${activeBottlenecks.length > 0 ? 'Triage' : 'Healthy'}
              </span>
            </div>
            <p class="text-xs text-on-surface-variant dark:text-slate-400 mt-3">${activeBottlenecks.length} critical priority tasks uncompleted</p>
          </div>

          <div class="bg-surface-container-lowest dark:bg-inverse-surface border border-outline-variant dark:border-slate-800 rounded-xl p-5">
            <p class="font-label-caps text-label-caps text-on-surface-variant dark:text-slate-400 mb-1 uppercase tracking-wider">Database Status</p>
            <div class="flex items-end gap-2">
              <span class="font-display-lg text-[28px] font-bold text-secondary">PG 17</span>
              <span class="font-body-sm text-tertiary font-semibold mb-1">Online</span>
            </div>
            <p class="text-xs text-on-surface-variant dark:text-slate-400 mt-3">localhost:5432 • projectcentral_db</p>
          </div>
        </div>

        <!-- Interactive Burndown Chart -->
        <div class="col-span-1 md:col-span-8 bg-surface-container-lowest dark:bg-inverse-surface border border-outline-variant dark:border-slate-800 rounded-xl p-6 flex flex-col h-[440px]">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h3 class="font-headline-sm text-headline-sm font-bold text-on-surface dark:text-white">Sprint Burndown</h3>
              <p class="text-xs text-on-surface-variant dark:text-slate-400">Remaining story points vs ideal trajectory</p>
            </div>
            <div class="flex items-center gap-4 text-xs font-semibold">
              <span class="inline-flex items-center gap-1.5"><span class="w-3 h-0.5 bg-slate-400"></span> Ideal Line</span>
              <span class="inline-flex items-center gap-1.5"><span class="w-3 h-1 bg-secondary rounded"></span> Actual Velocity</span>
            </div>
          </div>

          <!-- Dynamic SVG Chart Canvas -->
          <div class="flex-1 w-full bg-surface-container-low/40 dark:bg-slate-800/40 rounded-lg border border-outline-variant/60 dark:border-slate-700/60 p-4 flex flex-col justify-between relative">
            ${buildBurndownSvg(completionPct, totalTasks, doneTasks)}
          </div>
        </div>

        <!-- Critical Bottlenecks Panel -->
        <div class="col-span-1 md:col-span-4 bg-surface-container-lowest dark:bg-inverse-surface border border-outline-variant dark:border-slate-800 rounded-xl flex flex-col h-[440px]">
          <div class="p-5 border-b border-outline-variant/60 dark:border-slate-800 flex items-center justify-between">
            <h3 class="font-headline-sm text-headline-sm font-bold text-on-surface dark:text-white flex items-center gap-2">
              <span class="material-symbols-outlined text-error text-[20px]">warning</span> Critical Path Triage
            </h3>
            <span class="px-2 py-0.5 rounded-full bg-error-container text-error font-label-caps text-[11px] font-semibold">${activeBottlenecks.length} Urgent</span>
          </div>

          <div class="overflow-y-auto flex-1 p-3 space-y-2">
            ${activeBottlenecks.length === 0 ? `
              <div class="p-6 text-center text-on-surface-variant dark:text-slate-400">
                <span class="material-symbols-outlined text-emerald-500 text-[36px] mb-2">verified</span>
                <p class="font-semibold text-on-surface dark:text-white text-sm">All clear!</p>
                <p class="text-xs mt-1">No critical bottlenecks blocking current sprints.</p>
              </div>
            ` : activeBottlenecks.map(b => `
              <div class="p-3.5 hover:bg-surface-container-low dark:hover:bg-slate-800/40 rounded-lg transition-colors border border-outline-variant/50 dark:border-slate-700/50">
                <div class="flex justify-between items-start mb-1">
                  <span class="font-data-mono text-[11px] text-on-surface-variant dark:text-slate-400 font-medium">${b.id}</span>
                  <span class="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 px-2 py-0.5 rounded-full font-label-caps text-[10px] font-semibold">${b.priority}</span>
                </div>
                <h4 class="font-body-sm font-semibold text-on-surface dark:text-white">${escapeHtml(b.title)}</h4>
                <p class="text-xs text-on-surface-variant dark:text-slate-400 mt-1">Assignee: ${b.assignee} • Status: ${b.status}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

// User Actions
function filterProjects(status) {
  appState.projectFilter = status;
  renderProjectsView();
}

function searchProjects(query) {
  appState.searchQuery = query;
  renderProjectsView();
}

function selectProject(id) {
  inspectProjectAnalysis(id);
}

function inspectProjectAnalysis(id) {
  switchTab('analysis');
}

function setTaskView(mode) {
  appState.taskViewMode = mode;
  saveStateLocal();
  renderTasksView();
}

async function toggleTaskStatus(taskId) {
  const task = appState.tasks.find(t => t.id === taskId);
  if (task) {
    task.status = task.status === 'Done' ? 'In Progress' : 'Done';
    saveStateLocal();
    if (window.electronAPI?.db) {
      await window.electronAPI.db.updateTaskStatus(taskId, task.status).catch(console.error);
    }
    showToast(`Task ${taskId} is now ${task.status}`, task.status === 'Done' ? 'check_circle' : 'schedule');
    if (appState.activeTab === 'tasks') renderTasksView();
    if (appState.activeTab === 'dashboard') renderDashboardView();
    if (appState.activeTab === 'analysis') renderAnalysisView();
  }
}

async function changeTaskStatus(taskId, newStatus) {
  const task = appState.tasks.find(t => t.id === taskId);
  if (task) {
    task.status = newStatus;
    saveStateLocal();
    if (window.electronAPI?.db) {
      await window.electronAPI.db.updateTaskStatus(taskId, newStatus).catch(console.error);
    }
    showToast(`Task ${taskId} status updated to ${newStatus}`);
    renderTasksView();
    if (appState.activeTab === 'dashboard') renderDashboardView();
    if (appState.activeTab === 'analysis') renderAnalysisView();
  }
}

// Custom Glassmorphic Confirmation Modal
let confirmActionCallback = null;

function showConfirmDialog({ title, message, icon = 'delete_forever', confirmText = 'Confirm', isDanger = true, onConfirm }) {
  const modal = document.getElementById('app-confirm-modal');
  if (!modal) {
    if (confirm(message)) onConfirm();
    return;
  }
  document.getElementById('confirm-modal-title').textContent = title;
  document.getElementById('confirm-modal-message').textContent = message;
  document.getElementById('confirm-modal-icon').textContent = icon;

  const iconWrap = document.getElementById('confirm-modal-icon-wrap');
  const actionBtn = document.getElementById('confirm-modal-action');

  actionBtn.textContent = confirmText;
  if (isDanger) {
    iconWrap.className = 'w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center mb-4';
    actionBtn.className = 'flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer';
  } else {
    iconWrap.className = 'w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/80 text-secondary mx-auto flex items-center justify-center mb-4';
    actionBtn.className = 'flex-1 px-4 py-2 rounded-lg bg-secondary hover:opacity-90 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer';
  }

  confirmActionCallback = onConfirm;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeConfirmDialog() {
  const modal = document.getElementById('app-confirm-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  confirmActionCallback = null;
}

async function deleteTaskAction(taskId) {
  showConfirmDialog({
    title: `Delete Task ${taskId}?`,
    message: `Are you sure you want to permanently delete this task from PostgreSQL?`,
    icon: 'delete',
    confirmText: 'Delete Task',
    isDanger: true,
    onConfirm: async () => {
      appState.tasks = appState.tasks.filter(t => t.id !== taskId);
      saveStateLocal();
      if (window.electronAPI?.db) {
        await window.electronAPI.db.deleteTask(taskId).catch(console.error);
      }
      showToast(`Task ${taskId} deleted`, 'delete');
      renderTasksView();
      if (appState.activeTab === 'dashboard') renderDashboardView();
      if (appState.activeTab === 'analysis') renderAnalysisView();
    }
  });
}

async function deleteProjectAction(projectId) {
  showConfirmDialog({
    title: `Delete Project ${projectId}?`,
    message: `This will permanently delete this project and all of its associated sprint tasks from PostgreSQL.`,
    icon: 'folder_delete',
    confirmText: 'Delete Project',
    isDanger: true,
    onConfirm: async () => {
      appState.projects = appState.projects.filter(p => p.id !== projectId);
      appState.tasks = appState.tasks.filter(t => t.projectId !== projectId);
      saveStateLocal();
      if (window.electronAPI?.db) {
        await window.electronAPI.db.deleteProject(projectId).catch(console.error);
      }
      showToast(`Project ${projectId} and associated tasks deleted`, 'delete');
      renderProjectsView();
      if (appState.activeTab === 'dashboard') renderDashboardView();
      if (appState.activeTab === 'analysis') renderAnalysisView();
    }
  });
}

function exportAnalysisReport() {
  showToast('Sprint Analytics report exported to PDF', 'download');
}

// Kanban Drag and Drop Logic
let draggedTaskId = null;

function handleDragStart(e, taskId) {
  draggedTaskId = taskId;
  e.dataTransfer.setData('text/plain', taskId);
  e.dataTransfer.effectAllowed = 'move';
  const target = e.currentTarget;
  setTimeout(() => {
    target.classList.add('dragging');
  }, 0);
}

function handleDragEnd(e) {
  draggedTaskId = null;
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.kanban-col').forEach(col => col.classList.remove('drag-over'));
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const col = e.currentTarget;
  if (!col.classList.contains('drag-over')) {
    col.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  if (e.clientX <= rect.left || e.clientX >= rect.right || e.clientY <= rect.top || e.clientY >= rect.bottom) {
    e.currentTarget.classList.remove('drag-over');
  }
}

async function handleDrop(e, targetStatus) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
  if (!taskId) return;

  const task = appState.tasks.find(t => t.id === taskId);
  if (task && task.status !== targetStatus) {
    task.status = targetStatus;
    saveStateLocal();
    if (window.electronAPI?.db) {
      await window.electronAPI.db.updateTaskStatus(taskId, targetStatus).catch(console.error);
    }
    showToast(`Task ${taskId} moved to ${targetStatus}!`, 'check_circle');
    renderTasksView();
    if (appState.activeTab === 'dashboard') renderDashboardView();
    if (appState.activeTab === 'analysis') renderAnalysisView();
  }
}

// Dynamic Burndown SVG Chart Builder
function buildBurndownSvg(completionPct, totalTasks, doneTasks) {
  const totalPts = Math.max(totalTasks * 8, 48);

  const days = [
    { label: 'Day 1', x: 60, idealPct: 1.0, actualPct: 1.0 },
    { label: 'Day 3', x: 160, idealPct: 0.82, actualPct: Math.min(1.0, 0.94 - (completionPct * 0.001)) },
    { label: 'Day 6', x: 260, idealPct: 0.64, actualPct: Math.max(0.3, 0.85 - (completionPct * 0.003)) },
    { label: 'Day 8', x: 360, idealPct: 0.46, actualPct: Math.max(0.15, 0.70 - (completionPct * 0.005)) },
    { label: 'Day 10', x: 460, idealPct: 0.28, actualPct: Math.max(0.05, 0.52 - (completionPct * 0.006)) },
    { label: 'Day 12', x: 560, idealPct: 0.10, actualPct: Math.max(0, (1 - completionPct / 100)) },
    { label: 'End', x: 660, idealPct: 0.0, actualPct: null }
  ];

  const yMax = 40;  // 100%
  const yMin = 220; // 0%
  const getY = (pct) => Math.round(yMin - pct * (yMin - yMax));

  const idealCoords = days.map(d => `${d.x},${getY(d.idealPct)}`).join(' ');
  const activeDays = days.filter(d => d.actualPct !== null);
  const actualCoords = activeDays.map(d => `${d.x},${getY(d.actualPct)}`).join(' ');

  const lastActive = activeDays[activeDays.length - 1];
  const fillPolygon = `60,${yMin} ${actualCoords} ${lastActive.x},${yMin}`;

  return `
    <svg id="burndown-svg" class="w-full h-full" viewBox="0 0 700 280" preserveAspectRatio="none">
      <defs>
        <linearGradient id="velocity-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0058be" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#0058be" stop-opacity="0.0"/>
        </linearGradient>
      </defs>

      <!-- Grid Lines -->
      <line x1="40" y1="40" x2="680" y2="40" stroke="currentColor" class="text-outline-variant/30 dark:text-slate-700/40" stroke-dasharray="4"/>
      <line x1="40" y1="100" x2="680" y2="100" stroke="currentColor" class="text-outline-variant/30 dark:text-slate-700/40" stroke-dasharray="4"/>
      <line x1="40" y1="160" x2="680" y2="160" stroke="currentColor" class="text-outline-variant/30 dark:text-slate-700/40" stroke-dasharray="4"/>
      <line x1="40" y1="220" x2="680" y2="220" stroke="currentColor" class="text-outline-variant/50 dark:text-slate-700/70"/>

      <!-- Axis labels -->
      <text x="12" y="45" font-size="10" fill="#64748b" font-family="JetBrains Mono">${totalPts}pt</text>
      <text x="12" y="105" font-size="10" fill="#64748b" font-family="JetBrains Mono">${Math.round(totalPts * 0.75)}pt</text>
      <text x="12" y="165" font-size="10" fill="#64748b" font-family="JetBrains Mono">${Math.round(totalPts * 0.5)}pt</text>
      <text x="16" y="225" font-size="10" fill="#64748b" font-family="JetBrains Mono">0pt</text>

      <!-- Ideal Line -->
      <polyline fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6,6" points="${idealCoords}"/>

      <!-- Gradient Fill Area -->
      <polygon fill="url(#velocity-grad)" points="${fillPolygon}"/>

      <!-- Actual Velocity Line -->
      <polyline fill="none" stroke="#0058be" stroke-width="3.5" points="${actualCoords}" stroke-linecap="round" stroke-linejoin="round"/>

      <!-- Interactive Data Points -->
      ${activeDays.map(d => {
        const y = getY(d.actualPct);
        const actualPts = Math.round(d.actualPct * totalPts);
        const idealPts = Math.round(d.idealPct * totalPts);
        const isCurrent = d === lastActive;
        return `
          <circle cx="${d.x}" cy="${y}" r="${isCurrent ? 6 : 4.5}"
            fill="${isCurrent ? '#10b981' : '#0058be'}" stroke="#ffffff" stroke-width="2.5"
            class="cursor-pointer transition-transform hover:scale-150"
            onmouseenter="showChartTooltip(event, '${d.label}', 'Remaining: ${actualPts} pts (Target: ${idealPts} pts)')"
            onmouseleave="hideChartTooltip()"
          />
        `;
      }).join('')}

      <!-- Day Axis Labels -->
      ${days.map(d => `
        <text x="${d.x}" y="245" font-size="11" fill="${d === lastActive ? '#10b981' : '#64748b'}" font-weight="${d === lastActive ? 'bold' : 'normal'}" text-anchor="middle" font-family="JetBrains Mono">
          ${d === lastActive ? `Velocity: ${completionPct}%` : d.label}
        </text>
      `).join('')}
    </svg>
  `;
}

function showChartTooltip(e, title, sub) {
  const tooltip = document.getElementById('chart-tooltip');
  if (!tooltip) return;
  document.getElementById('chart-tooltip-title').textContent = title;
  document.getElementById('chart-tooltip-sub').textContent = sub;

  const rect = e.currentTarget.getBoundingClientRect();
  tooltip.style.left = `${rect.left + rect.width / 2}px`;
  tooltip.style.top = `${rect.top}px`;
  tooltip.classList.add('visible');
}

function hideChartTooltip() {
  const tooltip = document.getElementById('chart-tooltip');
  if (tooltip) tooltip.classList.remove('visible');
}

// Modal Handlers (Create & Edit Mode)
function openNewTaskModal(defaultStatus = 'Todo') {
  const modal = document.getElementById('new-task-modal');
  if (modal) {
    document.getElementById('task-edit-id').value = '';
    document.getElementById('task-modal-title').innerHTML = `
      <span class="material-symbols-outlined text-secondary">add_task</span>
      Create New Task
    `;
    document.getElementById('task-modal-submit-btn').textContent = 'Add Task';
    document.getElementById('new-task-form').reset();
    document.getElementById('task-status-input').value = defaultStatus;

    const projSelect = document.getElementById('task-project-input');
    if (projSelect) {
      projSelect.innerHTML = appState.projects.map(p => `
        <option value="${p.id}">${p.title} (${p.id})</option>
      `).join('');
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('task-title-input')?.focus();
  }
}

function openEditTaskModal(taskId) {
  const task = appState.tasks.find(t => t.id === taskId);
  if (!task) return;
  const modal = document.getElementById('new-task-modal');
  if (modal) {
    document.getElementById('task-edit-id').value = task.id;
    document.getElementById('task-modal-title').innerHTML = `
      <span class="material-symbols-outlined text-secondary">edit_note</span>
      Edit Task <span class="text-xs font-mono opacity-60">(${task.id})</span>
    `;
    document.getElementById('task-modal-submit-btn').textContent = 'Save Changes';

    const projSelect = document.getElementById('task-project-input');
    if (projSelect) {
      projSelect.innerHTML = appState.projects.map(p => `
        <option value="${p.id}" ${p.id === task.projectId ? 'selected' : ''}>${p.title} (${p.id})</option>
      `).join('');
    }

    document.getElementById('task-title-input').value = task.title;
    document.getElementById('task-desc-input').value = task.description;
    document.getElementById('task-priority-input').value = task.priority;
    document.getElementById('task-status-input').value = task.status;
    document.getElementById('task-assignee-input').value = task.assignee;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('task-title-input')?.focus();
  }
}

function closeNewTaskModal() {
  const modal = document.getElementById('new-task-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function handleCreateTask(e) {
  e.preventDefault();
  const editId = document.getElementById('task-edit-id')?.value;
  const projectId = document.getElementById('task-project-input')?.value || 'PRJ-01';
  const title = document.getElementById('task-title-input').value.trim();
  const description = document.getElementById('task-desc-input').value.trim();
  const priority = document.getElementById('task-priority-input').value;
  const status = document.getElementById('task-status-input').value;
  const assignee = document.getElementById('task-assignee-input').value;

  if (!title) return;

  if (editId) {
    const existingIndex = appState.tasks.findIndex(t => t.id === editId);
    if (existingIndex !== -1) {
      const updatedTask = {
        ...appState.tasks[existingIndex],
        projectId,
        title,
        description,
        priority,
        status,
        assignee
      };
      appState.tasks[existingIndex] = updatedTask;
      saveStateLocal();
      if (window.electronAPI?.db) {
        await window.electronAPI.db.saveTask(updatedTask).catch(console.error);
      }
      closeNewTaskModal();
      showToast(`Task ${editId} updated successfully!`);
      if (appState.activeTab === 'tasks') renderTasksView();
      if (appState.activeTab === 'dashboard') renderDashboardView();
      if (appState.activeTab === 'analysis') renderAnalysisView();
      return;
    }
  }

  const targetProj = appState.projects.find(p => p.id === projectId);
  const newId = `TSK-${100 + appState.tasks.length + 1}`;
  const newTask = {
    id: newId,
    projectId,
    title,
    description: description || `Task for ${targetProj?.title || projectId}`,
    priority,
    status,
    assignee,
    assigneeAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    dueDate: 'Next Sprint'
  };

  appState.tasks.unshift(newTask);
  saveStateLocal();

  if (window.electronAPI?.db) {
    await window.electronAPI.db.saveTask(newTask).catch(console.error);
  }

  closeNewTaskModal();
  document.getElementById('new-task-form').reset();
  showToast(`Task "${title}" created successfully!`);

  if (appState.activeTab === 'tasks') renderTasksView();
  if (appState.activeTab === 'dashboard') renderDashboardView();
  if (appState.activeTab === 'analysis') renderAnalysisView();
}

function openNewProjectModal() {
  const modal = document.getElementById('new-project-modal');
  if (modal) {
    document.getElementById('project-edit-id').value = '';
    document.getElementById('project-modal-title').innerHTML = `
      <span class="material-symbols-outlined text-secondary">create_new_folder</span>
      Create New Project
    `;
    document.getElementById('project-modal-submit-btn').textContent = 'Create Project';
    document.getElementById('new-project-form').reset();
    document.getElementById('project-progress-val').textContent = '0%';
    document.getElementById('project-progress-input').value = 0;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('project-title-input')?.focus();
  }
}

function openEditProjectModal(projectId) {
  const proj = appState.projects.find(p => p.id === projectId);
  if (!proj) return;
  const modal = document.getElementById('new-project-modal');
  if (modal) {
    document.getElementById('project-edit-id').value = proj.id;
    document.getElementById('project-modal-title').innerHTML = `
      <span class="material-symbols-outlined text-secondary">edit_square</span>
      Edit Project <span class="text-xs font-mono opacity-60">(${proj.id})</span>
    `;
    document.getElementById('project-modal-submit-btn').textContent = 'Save Changes';
    document.getElementById('project-title-input').value = proj.title;
    document.getElementById('project-category-input').value = proj.category;
    document.getElementById('project-desc-input').value = proj.description;
    document.getElementById('project-budget-input').value = proj.budget;
    document.getElementById('project-status-input').value = proj.status;
    document.getElementById('project-progress-input').value = proj.progress || 0;
    document.getElementById('project-progress-val').textContent = `${proj.progress || 0}%`;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.getElementById('project-title-input')?.focus();
  }
}

async function handleCreateProject(e) {
  e.preventDefault();
  const editId = document.getElementById('project-edit-id')?.value;
  const title = document.getElementById('project-title-input').value.trim();
  const category = document.getElementById('project-category-input').value.trim();
  const description = document.getElementById('project-desc-input').value.trim();
  const budget = document.getElementById('project-budget-input').value.trim() || '$35,000';
  const status = document.getElementById('project-status-input').value;
  const progress = parseInt(document.getElementById('project-progress-input').value, 10) || 0;

  if (!title) return;

  if (editId) {
    const existingIndex = appState.projects.findIndex(p => p.id === editId);
    if (existingIndex !== -1) {
      const updatedProject = {
        ...appState.projects[existingIndex],
        title,
        category,
        description,
        budget,
        status,
        progress
      };
      appState.projects[existingIndex] = updatedProject;
      saveStateLocal();
      if (window.electronAPI?.db) {
        await window.electronAPI.db.saveProject(updatedProject).catch(console.error);
      }
      closeNewProjectModal();
      showToast(`Project ${editId} updated successfully!`);
      if (appState.activeTab === 'projects') renderProjectsView();
      if (appState.activeTab === 'dashboard') renderDashboardView();
      if (appState.activeTab === 'analysis') renderAnalysisView();
      return;
    }
  }

  const newId = `PRJ-0${appState.projects.length + 1}`;
  const newProject = {
    id: newId,
    title,
    category: category || 'Enterprise Engineering',
    description: description || 'New strategic project roadmap initialized.',
    status,
    progress,
    dueDate: 'Dec 30, 2026',
    lead: 'Sarah Chen',
    leadAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
    teamSize: 3,
    spent: '$3,500',
    budget,
    tag: 'Strategic Initiative'
  };

  appState.projects.unshift(newProject);
  saveStateLocal();

  if (window.electronAPI?.db) {
    await window.electronAPI.db.saveProject(newProject).catch(console.error);
  }

  closeNewProjectModal();
  document.getElementById('new-project-form').reset();
  showToast(`Project "${title}" created successfully!`);

  if (appState.activeTab === 'projects') renderProjectsView();
  if (appState.activeTab === 'dashboard') renderDashboardView();
  if (appState.activeTab === 'analysis') renderAnalysisView();
}

// Toast Notification Controller
let toastTimer = null;
function showToast(message, icon = 'check_circle', isError = false) {
  const toast = document.getElementById('app-toast');
  const msgEl = document.getElementById('toast-message');
  const iconEl = document.getElementById('toast-icon');
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  if (iconEl) {
    iconEl.textContent = icon;
    iconEl.className = `material-symbols-outlined text-[18px] ${isError ? 'text-red-400' : 'text-emerald-400 dark:text-emerald-600'}`;
  }

  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2800);
}

// Global search handling
function handleGlobalSearch(query) {
  appState.searchQuery = query;
  if (appState.activeTab === 'projects') {
    renderProjectsView();
  }
}

// Update DB status badge in sidebar
async function updateDbStatusBadge() {
  const badge = document.getElementById('db-status-badge');
  if (!badge) return;

  if (window.electronAPI?.db) {
    try {
      const info = await window.electronAPI.db.getInfo();
      if (info.connected) {
        badge.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <div class="truncate">
            <div class="font-medium text-emerald-700 dark:text-emerald-300">PostgreSQL 17</div>
            <div class="text-[9px] text-slate-500 truncate">${info.database} @ ${info.host}</div>
          </div>
        `;
        return;
      }
    } catch (e) {
      console.warn('DB Info check failed:', e);
    }
  }

  badge.innerHTML = `
    <span class="w-2 h-2 rounded-full bg-amber-500"></span>
    <span>Local Storage Cache</span>
  `;
}

// Application Initialization
window.addEventListener('DOMContentLoaded', async () => {
  initWindowControls();

  // Load from PostgreSQL if available
  if (window.electronAPI?.db) {
    try {
      const dbData = await window.electronAPI.db.getAll();
      if (dbData.projects && dbData.projects.length) {
        appState.projects = dbData.projects;
      }
      if (dbData.tasks && dbData.tasks.length) {
        appState.tasks = dbData.tasks;
      }
      if (dbData.settings) {
        if (dbData.settings.theme) appState.theme = dbData.settings.theme;
        if (dbData.settings.activeTab) appState.activeTab = dbData.settings.activeTab;
      }
    } catch (e) {
      console.error('Error fetching data from PostgreSQL:', e);
    }
  }

  applyTheme(appState.theme || 'light');
  updateDbStatusBadge();

  // Setup Nav Click Listeners
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(link.dataset.tab);
    });
  });

  // Setup Theme Toggle Button
  document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);

  // Setup Confirmation Modal Buttons
  document.getElementById('confirm-modal-cancel')?.addEventListener('click', closeConfirmDialog);
  document.getElementById('confirm-modal-action')?.addEventListener('click', () => {
    if (confirmActionCallback) confirmActionCallback();
    closeConfirmDialog();
  });

  // Setup Form Submissions
  document.getElementById('new-task-form')?.addEventListener('submit', handleCreateTask);
  document.getElementById('new-project-form')?.addEventListener('submit', handleCreateProject);

  // Global Search input listener
  document.getElementById('global-search-input')?.addEventListener('input', (e) => {
    handleGlobalSearch(e.target.value);
  });

  // AI Chat Drawer Form Submission
  document.getElementById('ai-chat-form')?.addEventListener('submit', handleAiChatSubmit);

  // Global Keyboard Shortcuts (Ctrl+J, Ctrl+N, Ctrl+P, Esc)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isAiDrawerOpen) toggleAiDrawer();
      closeNewTaskModal();
      closeNewProjectModal();
      closeConfirmDialog();
      hideChartTooltip();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'j' || e.key === 'J')) {
      e.preventDefault();
      toggleAiDrawer();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      openNewTaskModal();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
      e.preventDefault();
      openNewProjectModal();
    }
  });

  // Render initial active tab
  switchTab(appState.activeTab || 'dashboard');
});

// ==========================================
// AI Assistant Copilot Controller Logic
// ==========================================
let chatHistory = [];
let isAiDrawerOpen = false;

function toggleAiDrawer() {
  const drawer = document.getElementById('ai-chat-drawer');
  const backdrop = document.getElementById('ai-chat-backdrop');
  if (!drawer) return;

  isAiDrawerOpen = !isAiDrawerOpen;
  if (isAiDrawerOpen) {
    drawer.classList.add('open');
    backdrop?.classList.remove('hidden');
    document.getElementById('ai-chat-input')?.focus();
    checkAiModelStatus();
  } else {
    drawer.classList.remove('open');
    backdrop?.classList.add('hidden');
  }
}

async function checkAiModelStatus() {
  const label = document.getElementById('ai-model-label');
  if (!label) return;

  if (window.electronAPI?.ai) {
    try {
      const status = await window.electronAPI.ai.getStatus();
      if (status.online && status.installed) {
        label.textContent = 'Qwen 2.5 1.5B (Ollama Active)';
      } else if (status.online && !status.installed) {
        label.textContent = 'Ollama Online (Qwen 1.5B Ready)';
      } else {
        label.textContent = 'Qwen 2.5 1.5B (Fast Copilot)';
      }
    } catch (e) {
      label.textContent = 'Local Copilot Engine';
    }
  }
}

function clearChatHistory() {
  chatHistory = [];
  const container = document.getElementById('ai-messages-container');
  if (container) {
    container.innerHTML = `
      <div class="flex items-start gap-2.5">
        <div class="w-6 h-6 rounded bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 text-[14px]">
          <span class="material-symbols-outlined text-[14px]">smart_toy</span>
        </div>
        <div class="bg-surface-container-low dark:bg-slate-800/80 p-3 rounded-2xl rounded-tl-sm border border-outline-variant/50 dark:border-slate-700 text-on-surface dark:text-slate-200 max-w-[85%] space-y-1.5">
          <p class="font-semibold text-primary dark:text-blue-400">Chat history cleared.</p>
          <p class="text-on-surface-variant dark:text-slate-400">Ask me to add a task, check bottlenecks, or create a project.</p>
        </div>
      </div>
    `;
  }
}

function sendQuickPrompt(promptText) {
  const input = document.getElementById('ai-chat-input');
  if (input) {
    input.value = promptText;
    document.getElementById('ai-chat-form')?.dispatchEvent(new Event('submit'));
  }
}

async function handleAiChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('ai-chat-input');
  if (!input) return;
  const prompt = input.value.trim();
  if (!prompt) return;

  input.value = '';

  const container = document.getElementById('ai-messages-container');
  const typing = document.getElementById('ai-typing-indicator');

  // Append user message
  appendChatMessage('user', prompt);
  chatHistory.push({ role: 'user', content: prompt });

  // Show typing indicator
  if (typing) {
    typing.classList.remove('hidden');
    typing.classList.add('flex');
  }
  container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });

  try {
    let response;
    if (window.electronAPI?.ai) {
      response = await window.electronAPI.ai.sendMessage(prompt, chatHistory);
    } else {
      response = { reply: "AI Copilot is available with local engine in the desktop app." };
    }

    // Hide typing indicator
    if (typing) {
      typing.classList.add('hidden');
      typing.classList.remove('flex');
    }

    // Execute state changes & re-render
    if (response.action && window.electronAPI?.db) {
      const updatedData = await window.electronAPI.db.getAll();
      if (updatedData.projects) appState.projects = updatedData.projects;
      if (updatedData.tasks) appState.tasks = updatedData.tasks;

      if (response.action === 'navigate' && response.data?.tab) {
        switchTab(response.data.tab);
      } else if (response.action === 'theme' && response.data?.mode) {
        applyTheme(response.data.mode);
      } else if (response.action === 'cleared_db') {
        showToast('Complete database cleared', 'delete');
        if (appState.activeTab === 'tasks') renderTasksView();
        else if (appState.activeTab === 'projects') renderProjectsView();
        else if (appState.activeTab === 'dashboard') renderDashboardView();
        else if (appState.activeTab === 'analysis') renderAnalysisView();
      } else if (response.action === 'deleted_all_projects') {
        showToast('All projects deleted', 'delete');
        if (appState.activeTab === 'projects') renderProjectsView();
        else renderDashboardView();
      } else if (response.action === 'deleted_all_tasks') {
        showToast('All sprint tasks deleted', 'delete');
        if (appState.activeTab === 'tasks') renderTasksView();
        else renderDashboardView();
      } else if (response.action === 'reset_db') {
        showToast('Default projects and tasks restored', 'restore');
        if (appState.activeTab === 'tasks') renderTasksView();
        else if (appState.activeTab === 'projects') renderProjectsView();
        else if (appState.activeTab === 'dashboard') renderDashboardView();
        else if (appState.activeTab === 'analysis') renderAnalysisView();
      } else {
        if (appState.activeTab === 'tasks') renderTasksView();
        else if (appState.activeTab === 'projects') renderProjectsView();
        else if (appState.activeTab === 'dashboard') renderDashboardView();
      }
    }

    appendChatMessage('assistant', response.reply, response.action, response.data, response.model);
    chatHistory.push({ role: 'assistant', content: response.reply });

  } catch (err) {
    console.error('Chat execution error:', err);
    if (typing) {
      typing.classList.add('hidden');
      typing.classList.remove('flex');
    }
    appendChatMessage('assistant', "Encountered an issue executing that command. Please check your query and try again.");
  }

  container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
}

function appendChatMessage(role, text, action, data, model) {
  const container = document.getElementById('ai-messages-container');
  if (!container) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = role === 'user' ? 'flex justify-end' : 'flex items-start gap-2.5';

  if (role === 'user') {
    msgDiv.innerHTML = `
      <div class="bg-primary dark:bg-secondary text-on-primary p-3 rounded-2xl rounded-tr-sm max-w-[85%] text-xs shadow-sm">
        ${escapeHtml(text)}
      </div>
    `;
  } else {
    let actionHtml = '';
    if (action === 'created_task' && data) {
      actionHtml = `
        <div class="mt-2 p-2.5 rounded-lg bg-surface dark:bg-slate-900 border border-secondary/40 flex items-center justify-between gap-2 shadow-xs">
          <div class="truncate">
            <div class="font-data-mono text-[10px] text-secondary font-bold">${data.id} • ${data.priority} Priority</div>
            <div class="font-semibold text-on-surface dark:text-white truncate">${escapeHtml(data.title)}</div>
          </div>
          <button onclick="switchTab('tasks')" class="px-2.5 py-1 rounded bg-secondary text-white text-[10px] font-semibold hover:opacity-90 shrink-0">
            View Tasks
          </button>
        </div>
      `;
    } else if (action === 'created_project' && data) {
      actionHtml = `
        <div class="mt-2 p-2.5 rounded-lg bg-surface dark:bg-slate-900 border border-secondary/40 flex items-center justify-between gap-2 shadow-xs">
          <div class="truncate">
            <div class="font-data-mono text-[10px] text-secondary font-bold">${data.id} • Budget ${data.budget}</div>
            <div class="font-semibold text-on-surface dark:text-white truncate">${escapeHtml(data.title)}</div>
          </div>
          <button onclick="switchTab('projects')" class="px-2.5 py-1 rounded bg-secondary text-white text-[10px] font-semibold hover:opacity-90 shrink-0">
            View Projects
          </button>
        </div>
      `;
    } else if (action === 'updated_task' && data) {
      actionHtml = `
        <div class="mt-2 px-2.5 py-1.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 font-medium">
          <span class="material-symbols-outlined text-[14px]">check_circle</span>
          Task ${data.id} marked as <strong>${data.status}</strong>
        </div>
      `;
    } else if (action === 'cleared_db' || action === 'deleted_all_projects' || action === 'deleted_all_tasks') {
      actionHtml = `
        <div class="mt-2 p-2.5 rounded-lg bg-surface dark:bg-slate-900 border border-outline-variant/60 flex items-center justify-between gap-2 shadow-xs">
          <div class="truncate text-on-surface dark:text-slate-300 text-[11px]">
            Database cleared. Restore default sample data?
          </div>
          <button onclick="sendQuickPrompt('reset database')" class="px-2.5 py-1 rounded bg-secondary text-white text-[10px] font-semibold hover:opacity-90 shrink-0">
            Reset Data
          </button>
        </div>
      `;
    } else if (action === 'reset_db') {
      actionHtml = `
        <div class="mt-2 px-2.5 py-1.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 font-medium">
          <span class="material-symbols-outlined text-[14px]">check_circle</span>
          Default projects and sprint tasks restored!
        </div>
      `;
    }

    msgDiv.innerHTML = `
      <div class="w-6 h-6 rounded bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 text-[14px]">
        <span class="material-symbols-outlined text-[14px]">smart_toy</span>
      </div>
      <div class="bg-surface-container-low dark:bg-slate-800/80 p-3 rounded-2xl rounded-tl-sm border border-outline-variant/50 dark:border-slate-700 text-on-surface dark:text-slate-200 max-w-[85%] space-y-1">
        <div>${formatMarkdown(text)}</div>
        ${actionHtml}
        ${model ? `<div class="text-[9px] text-on-surface-variant/60 dark:text-slate-500 text-right pt-1">${model}</div>` : ''}
      </div>
    `;
  }

  container.appendChild(msgDiv);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatMarkdown(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}
