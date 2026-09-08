const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./database/db');

let mainWindow;

async function createWindow() {
  // Initialize PostgreSQL schema and seed data
  try {
    await db.initDatabase();
    console.log('PostgreSQL initialized successfully.');
  } catch (err) {
    console.error('Failed to initialize PostgreSQL:', err);
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    title: 'ProjectCentral',
    frame: false, // Frameless for custom titlebar
    backgroundColor: '#f8f9ff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Window control IPC handlers
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-state-changed', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-state-changed', { isMaximized: false });
  });
}

// Register Database IPC Handlers
ipcMain.handle('db:get-all', async () => {
  return await db.getAllData();
});

ipcMain.handle('db:save-project', async (_event, project) => {
  return await db.saveProject(project);
});

ipcMain.handle('db:delete-project', async (_event, id) => {
  return await db.deleteProject(id);
});

ipcMain.handle('db:delete-all-projects', async () => {
  return await db.deleteAllProjects();
});

ipcMain.handle('db:save-task', async (_event, task) => {
  return await db.saveTask(task);
});

ipcMain.handle('db:update-task-status', async (_event, { id, status }) => {
  return await db.updateTaskStatus(id, status);
});

ipcMain.handle('db:delete-task', async (_event, id) => {
  return await db.deleteTask(id);
});

ipcMain.handle('db:delete-all-tasks', async () => {
  return await db.deleteAllTasks();
});

ipcMain.handle('db:clear-all', async () => {
  return await db.clearDatabase();
});

ipcMain.handle('db:reset-defaults', async () => {
  return await db.resetToDefaults();
});

ipcMain.handle('db:save-setting', async (_event, { key, value }) => {
  return await db.saveSetting(key, value);
});

ipcMain.handle('db:get-info', async () => {
  return await db.getDatabaseInfo();
});

// Register AI Assistant Copilot Handlers
const aiAgent = require('./services/ai_agent');

ipcMain.handle('ai:send-message', async (_event, { prompt, history }) => {
  return await aiAgent.processUserMessage(prompt, history);
});

ipcMain.handle('ai:get-status', async () => {
  return await aiAgent.getAgentStatus();
});

ipcMain.handle('ai:pull-model', async (_event, modelName) => {
  return await aiAgent.pullModel(modelName);
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
