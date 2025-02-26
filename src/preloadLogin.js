const { ipcRenderer, contextBridge } = require('electron');

function submitLoginData(url, username, password) {
  ipcRenderer.send('login-data-submitted', url, username, password);
}

// Expose the submitLoginData function to the renderer process
contextBridge.exposeInMainWorld('electron', {
  submitLoginData: submitLoginData,
});