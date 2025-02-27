const { app, BrowserWindow, ipcMain, Menu, Notification } = require('electron');
const path = require('path');
const { shell } = require('electron');

// Charger electron-store dynamiquement
let Store;
(async () => {
  const module = await import('electron-store');
  Store = module.default;
})();

let storage; // Stocker l'instance de Store

// Vérifier si l'application a été lancée via un installateur (Squirrel)
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;
let loginWindow;

const sendNotification = (title, body) => {
  const notification = new Notification({
    title: title,
    body: body,
    icon: path.join(__dirname, '/assets/icon.png'),
  });

  notification.show();
}

const createMenu = () => {
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Se déconnecter',
          click: () => {
            removeLoginData();
            sendNotification('Déconnexion', 'Vous avez été déconnecté de Pronote.');
            if (mainWindow) {
              mainWindow.close();
            }
            createLoginWindow();
          }
        },
        {
          label: 'Quitter l\'application',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'About',
      submenu: [
        {
          label: 'About',
          click: () => {
            const aboutWindow = new BrowserWindow({
              width: 400,
              height: 300,
              title: 'About',
              autoHideMenuBar: true,
              webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
              },
            });

            aboutWindow.loadURL(`data:text/html,
              <html>
              <head>
                <title>About</title>
              </head>
              <body>
                <h1>Pronote APP pour les élèves</h1>
                <p>Développé par <a href='https://naosis.me'>en electron.</a></p>
                <button onclick="window.close()">Close</button>
              </body>
              </html>`);
          }
        },
        {
          label: 'Naos',
          click: () => {
            shell.openExternal('https://naosis.me');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
};

const createLoginWindow = () => {
  loginWindow = new BrowserWindow({
    width: 800,
    height: 600,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '/assets/icon.png'),  // Chemin de l'icône
    webPreferences: {
      preload: path.join(__dirname, 'preloadLogin.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  loginWindow.loadFile(path.join(__dirname, 'login.html'));

  loginWindow.on('closed', () => {
    loginWindow = null;
  });
};

const v2MainWindow = (url) => {
  console.log('Création de la fenêtre v2 principale avec l\'URL:', url); // Debug : création de la fenêtre principale
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    show: false,  // Cacher la fenêtre au démarrage
    icon: path.join(__dirname, '/assets/icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '/v2/preloadV2.js'),  // Preload pour la fenêtre principale
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const mainDomain = new URL(url).hostname;
  if (!mainDomain.endsWith('index-education.net')) {
    removeLoginData();
    sendNotification('Erreur', 'Le site n\'est pas un domaine d\'index-education.net');
    createLoginWindow();
    return;
  }

  // check if the url return an error (other than 200 OK)
  if (url) {
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.log('Error code:', errorCode);
      console.log('Error description:', errorDescription);
      console.log('Validated URL:', validatedURL);
      console.log('Is main frame:', isMainFrame);
      if (errorCode !== -3) {
        removeLoginData();
        sendNotification('Erreur', 'Impossible de charger la page. Veuillez vérifier l\'URL.');
        createLoginWindow();
      }
    });
  }

  mainWindow.loadURL(url);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-navigate', (event, newUrl) => {
    const domain = new URL(newUrl).hostname;
    console.log('Nouvelle URL:', newUrl);  // Debug : Afficher l'URL après redirection

    // Vérifier que les données de login existent
    const data = getLoginData();
    if (data && data.login && data.password) {
      // Vérifier si le domaine est différent de "index-education.net"
      if (!domain.includes('index-education.net')) {
        console.log('Le domaine n\'est pas index-education.net. La fenêtre va être cachée.');
        mainWindow.webContents.executeJavaScript(`document.getElementById("username").value = "${data.login}";`)
        mainWindow.webContents.executeJavaScript(`document.getElementById("password").value = "${data.password}";`)
        mainWindow.webContents.executeJavaScript('document.getElementById("submitBtn").click();')
        // mainWindow.hide();  // Cacher la fenêtre si l'URL n'est pas du domaine souhaité
      } else {
        console.log('Le domaine est index-education.net. La fenêtre va être affichée.');
        mainWindow.show();  // Afficher la fenêtre si l'URL est du domaine souhaité
      }
    } else {
      console.error("Les données de login sont introuvables ou incorrectes.");
    }
  });
};

const createMainWindow = (url) => {
  console.log('Création de la fenêtre principale avec l\'URL:', url); // Debug : création de la fenêtre principale
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    show: false,  // Cacher la fenêtre au démarrage
    icon: path.join(__dirname, '/assets/icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preloadMain.js'),  // Preload pour la fenêtre principale
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const mainDomain = new URL(url).hostname;
  if (!mainDomain.endsWith('index-education.net')) {
    removeLoginData();
    sendNotification('Erreur', 'Le site n\'est pas un domaine d\'index-education.net');
    createLoginWindow();
    return;
  }

  // check if the url return an error (other than 200 OK)
  if (url) {
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.log('Error code:', errorCode);
      console.log('Error description:', errorDescription);
      console.log('Validated URL:', validatedURL);
      console.log('Is main frame:', isMainFrame);
      if (errorCode !== -3) {
        removeLoginData();
        sendNotification('Erreur', 'Impossible de charger la page. Veuillez vérifier l\'URL.');
        createLoginWindow();
      }
    });
  }

  mainWindow.loadURL(url);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-navigate', (event, newUrl) => {
    const domain = new URL(newUrl).hostname;
    console.log('Nouvelle URL:', newUrl);  // Debug : Afficher l'URL après redirection

    // Vérifier que les données de login existent
    const data = getLoginData();
    if (data && data.login && data.password) {
      // Vérifier si le domaine est différent de "index-education.net"
      if (!domain.includes('index-education.net')) {
        console.log('Le domaine n\'est pas index-education.net. La fenêtre va être cachée.');
        mainWindow.webContents.executeJavaScript(`document.getElementById("username").value = "${data.login}";`)
        mainWindow.webContents.executeJavaScript(`document.getElementById("password").value = "${data.password}";`)
        mainWindow.webContents.executeJavaScript('document.getElementById("submitBtn").click();')
        // mainWindow.hide();  // Cacher la fenêtre si l'URL n'est pas du domaine souhaité
      } else {
        console.log('Le domaine est index-education.net. La fenêtre va être affichée.');
        mainWindow.show();  // Afficher la fenêtre si l'URL est du domaine souhaité
      }
    } else {
      console.error("Les données de login sont introuvables ou incorrectes.");
    }
  });
};

// Récupérer les données de login depuis le localdb
const getLoginData = () => {
  if (Store) {
    storage = new Store();
    const data = storage.get('ploginData');
    if (data && data.url && data.login && data.password) {
      return data;
    }
  }
  return null;
};

const removeLoginData = () => {
  storage.delete('ploginData');
};

ipcMain.on('logout', (event) => {
  removeLoginData();
  if (mainWindow) {
    mainWindow.close();
  }
  createLoginWindow();
});

// Fonction principale qui démarre l'application
app.whenReady().then(() => {
  createMenu();

  (async () => {
    await import('electron-store').then((module) => {
      Store = module.default;
      storage = new Store();
      const loginData = getLoginData();
      if (loginData && loginData.url) {

        createMainWindow(loginData.url);
      } else {
        createLoginWindow();
      }
    });
  })();
});

// Capter l'événement 'login-data-submitted' du renderer
ipcMain.on('login-data-submitted', (event, url, login, password) => {
  storage.set('ploginData', { url, login, password });
  if (loginWindow) {
    loginWindow.close();
  }
  createMainWindow(url);
});

// Quitter l'application si toutes les fenêtres sont fermées
app.on('window-all-closed', () => {
  app.quit();
});