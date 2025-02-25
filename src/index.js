const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('fs');
const { log } = require('node:console');


ipcMain.handle('read-file', (event, path) => {
  return fs.readFileSync(path, 'utf-8');  // Exemple de lecture de fichier
});

// Vérifier si l'application a été lancée via un installateur (Squirrel)
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Créer la fenêtre de login
const createLoginWindow = () => {
  console.log('Création de la fenêtre de login'); // Debug : création de la fenêtre de login
  const loginWindow = new BrowserWindow({
    width: 800,
    height: 600,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '/assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preloadLogin.js'),
      nodeIntegration: true,
    },
  });

  loginWindow.loadFile(path.join(__dirname, 'login.html'));
};

// Créer la fenêtre principale avec l'URL spécifiée dans datas.json
const createMainWindow = (url) => {
  console.log('Création de la fenêtre principale avec l\'URL:', url); // Debug : création de la fenêtre principale
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    hide: true,
    icon: path.join(__dirname, '/assets/icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  mainWindow.loadURL(url);

  const data = getLoginData();

  mainWindow.webContents.on('did-navigate', (event, newUrl) => {

    const domain = new URL(newUrl).hostname;
    console.log('Nouvelle URL:', newUrl);  // Debug : Afficher l'URL après redirection

    // Vérifier si le domaine est différent de "index-education.net"
    if (!domain.includes('index-education.net')) {
      console.log('Le domaine n\'est pas index-education.net. La fenêtre va être cachée.');
      mainWindow.webContents.executeJavaScript('document.getElementById("username").value = "' + data.login + '";')
      mainWindow.webContents.executeJavaScript('document.getElementById("password").value = "' + data.password + '";')
      mainWindow.webContents.executeJavaScript('document.getElementById("submitBtn").click();')
      mainWindow.hide();  // Cacher la fenêtre si l'URL n'est pas du domaine souhaité
    } else {
      console.log('Le domaine est index-education.net. La fenêtre va être affichée.');
      mainWindow.show();  // Afficher la fenêtre si l'URL est du domaine souhait
    }
  });
};

// Récupérer les données de login depuis le fichier datas.json
const getLoginData = () => {
  const filePath = path.join('datas.json');
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath);
    return JSON.parse(data);
  }
  console.log('Fichier datas.json non trouvé'); // Debug : fichier non trouvé
  return null;
};

// Fonction principale qui démarre l'application
app.whenReady().then(() => {
  const loginData = getLoginData();
  if (loginData && loginData.url) {
    createMainWindow(loginData.url);
  } else {
    createLoginWindow();
  }
});


// Capter l'événement 'login-data-submitted' du renderer
ipcMain.on('login-data-submitted', (event, url, login, password) => {
  fs.writeFile("datas.json", JSON.stringify({ url, login, password }), (err) => {
    if (err) {
      console.log('Erreur lors de l\'écriture des données de login:', err); // Debug : erreur lors de l'écriture des données
    } else {
      console.log('Données de login enregistrées avec succès'); // Debug : données enregistrées avec succès
      
      const window = BrowserWindow.getFocusedWindow();
      window.close();

      createMainWindow(url);
      
    }
  });
});


// Quitter l'application si toutes les fenêtres sont fermées
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
