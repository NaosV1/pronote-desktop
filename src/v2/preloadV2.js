const { ipcRenderer, contextBridge } = require('electron');

function logout() {
  ipcRenderer.send('logout');
}

// Expose the logout function to the renderer process
contextBridge.exposeInMainWorld('api', {
  logout: logout,
});

ipcRenderer.on('logout', () => {
  logout();
});