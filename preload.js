const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  onWindowStateChange: (callback) => {
    ipcRenderer.on('window-state-changed', (_event, value) => callback(value));
  },

  // PostgreSQL Database Bridge
  db: {
    getAll: () => ipcRenderer.invoke('db:get-all'),
    saveProject: (project) => ipcRenderer.invoke('db:save-project', project),
    deleteProject: (id) => ipcRenderer.invoke('db:delete-project', id),
    deleteAllProjects: () => ipcRenderer.invoke('db:delete-all-projects'),
    saveTask: (task) => ipcRenderer.invoke('db:save-task', task),
    updateTaskStatus: (id, status) => ipcRenderer.invoke('db:update-task-status', { id, status }),
    deleteTask: (id) => ipcRenderer.invoke('db:delete-task', id),
    deleteAllTasks: () => ipcRenderer.invoke('db:delete-all-tasks'),
    clearAll: () => ipcRenderer.invoke('db:clear-all'),
    resetDefaults: () => ipcRenderer.invoke('db:reset-defaults'),
    saveSetting: (key, value) => ipcRenderer.invoke('db:save-setting', { key, value }),
    getInfo: () => ipcRenderer.invoke('db:get-info')
  },

  // AI Assistant Copilot Bridge (Qwen 2.5 1.5B / Local Engine)
  ai: {
    sendMessage: (prompt, history = []) => ipcRenderer.invoke('ai:send-message', { prompt, history }),
    getStatus: () => ipcRenderer.invoke('ai:get-status'),
    pullModel: (modelName) => ipcRenderer.invoke('ai:pull-model', modelName)
  }
});
