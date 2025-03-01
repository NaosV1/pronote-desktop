const { app, globalShortcut, BrowserWindow, ipcMain, Menu, Notification, session, dialog } = require('electron');
const path = require('path');
const { shell } = require('electron');
const { create } = require('domain');
const { type } = require('os');

// Charger electron-store dynamiquement
let Store;
let storage; // Stocker l'instance de Store
let profileslist = []; // Variable globale pour stocker les profils

currentSession = '';

(async () => {
  const module = await import('electron-store');
  Store = module.default;
  storage = new Store();
  profileslist = getProfiles(); // Initialiser profileslist
})();

// Récupérer les profils depuis le localdb
const getProfiles = () => {
  if (storage) {
    const profiles = storage.get('profiles') || [];
    console.log('Profils:', profiles);  // Debug : Afficher les profils
    return profiles;
  }
  return [];
};

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

const createMenu = (profiles) => {
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Se déconnecter',
          click: () => {
            sendNotification('Déconnexion', 'Vous avez été déconnecté de Pronote.');
            if (mainWindow) {
              mainWindow.close();
            }
            createLoginWindow();
          }
        },
        {
          label: 'Quitter l\'application',
          role: 'quit'
        },
        {
          label: 'Recharger la page',
          role: 'reload'
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteandmatchstyle' },
        { role: 'delete' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'Profiles',
      submenu: [
        {
          label: 'Ajouter',
          click: () => {
            // go to the login page
            if (mainWindow) {
              mainWindow.close();
            }
            createLoginWindow();
          }
        },
        {type: 'separator'},
        {
          label: 'Changer de profil',
          submenu: profiles.map(profile => {
            return {
              label: profile.login,
              click: () => {
                if (profile.login === currentSession) {
                  sendNotification('Info', `Vous êtes déjà connecté sur ${profile.login}.`);
                  return;
                }
                if (mainWindow) {
                  mainWindow.close();
                }
                createMainWindow(profile.url, profile.login, profile.password);
              }
            }
          })
        },
        {
          label: 'Supprimer',
          submenu: profiles.map(profile => {
            return {
              label: profile.login,
              click: () => {
                console.log(`Déconnexion de ${profile.login}`);
                removeProfile(profile.login);
                sendNotification('Déconnexion', `Vous avez été déconnecté de ${profile.login}.`);
                if (profile.login === currentSession && mainWindow) {
                  mainWindow.close();
                  createLoginWindow(); // Ouvre la fenêtre de connexion
                }
              }
            }
          })
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
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

const createMainWindow = (url, login, password) => {
  currentSession = login;
  console.log('Création de la fenêtre principale avec l\'URL:', url); // Debug : création de la fenêtre principale
  console.log('Utilisation de l\'identifiant : ', login);

  // Effacer les cookies de la session pour éviter les conflits
  session.defaultSession.clearStorageData({ storages: ['cookies'] });

  // Créer la fenêtre principale
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    show: false,  // Cacher la fenêtre au démarrage
    icon: path.join(__dirname, '/assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preloadMain.js'),  // Preload pour la fenêtre principale
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Vérifier si l'URL est dans le domaine correct
  const mainDomain = new URL(url).hostname;
  if (!mainDomain.endsWith('index-education.net')) {
    removeLoginData();
    sendNotification('Erreur', 'Le site n\'est pas un domaine d\'index-education.net');
    createLoginWindow();
    return;
  }

  // Gestion des erreurs de chargement de la page
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error('Erreur de chargement:', errorCode, errorDescription, 'URL:', validatedURL, 'Is main frame:', isMainFrame);
    if (errorCode !== -3) {  // Exclure les annulations de navigation par l'utilisateur
      removeLoginData();
      sendNotification('Erreur', 'Impossible de charger la page. Veuillez vérifier l\'URL.');
      createLoginWindow();
    }
  });

  // Charger l'URL
  mainWindow.loadURL(url);


  // Gestion de la navigation vers une nouvelle URL
  mainWindow.webContents.on('did-navigate', (event, newUrl) => {
    const domain = new URL(newUrl).hostname;
    console.log('Nouvelle URL:', newUrl);  // Debug : Afficher l'URL après redirection

    // Vérifier si le domaine est différent de "index-education.net"
    if (!domain.includes('index-education.net')) {
      console.log('Le domaine n\'est pas index-education.net. Identification en cours...');
      // S'assurer que la page est bien chargée avant d'exécuter du JavaScript
      mainWindow.webContents.executeJavaScript(`
        const usernameInput = document.getElementById("username");
        const passwordInput = document.getElementById("password");
        const submitBtn = document.getElementById("submitBtn");

        if (usernameInput && passwordInput && submitBtn) {
          usernameInput.value = "${login}";
          passwordInput.value = "${password}";
          submitBtn.click();
        } else {
          console.error("Les éléments de formulaire ne sont pas disponibles.");
        }
      `).catch(error => {
        console.error("Erreur lors de l'exécution du script:", error);
      });
    } else {
      console.log('Le domaine est index-education.net.');
      if (mainWindow) {
        mainWindow.show();  // Afficher la fenêtre si l'URL est du domaine souhaité
      }
    }
  });
};


// Ajouter un profil au localdb
const addProfile = (url, login, password) => {
  const profiles = getProfiles();
  profiles.push({ url, login, password });
  storage.set('profiles', profiles);
  profileslist = profiles;  // Mettre à jour profileslist
  createMenu(profileslist);  // Mettre à jour le menu
};


// Fonction pour supprimer un profil
const removeProfile = (login) => {
  const profiles = getProfiles().filter(profile => profile.login !== login);
  storage.set('profiles', profiles);  // Met à jour les profils stockés
  profileslist = profiles;  // Mettre à jour profileslist
  createMenu(profileslist);  // Mettre à jour le menu
};


ipcMain.on('logout', (event) => {
  if (mainWindow && mainWindow.webContents) {  // Vérifier si mainWindow est non null
    const currentUrl = mainWindow.webContents.getURL();
    removeProfile(currentUrl);
    mainWindow.close();
  } else {
    console.error('Erreur: mainWindow ou webContents est null');
  }
  createLoginWindow();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

const showDialog = async () => {
  let profileslist = await getProfiles(); // Charger les profils

    // Crée les boutons pour la boîte de dialogue avec les profils
    const buttons = [
      `Se déconnecter de ${currentSession}`,
      ...profileslist.map(profile => `Se connecter sur ${profile.login}`),
      'Annuler'
    ];

    // Crée une pop-up native avec une boîte de dialogue personnalisée
    dialog.showMessageBox({
      type: 'info',
      buttons: buttons,
      defaultId: buttons.length - 1, // 'Annuler' est le bouton par défaut
      title: 'Gestion de session',
      message: 'Gestion de session',
      detail: 'Que souhaitez-vous faire ?',
    }).then(result => {
      const buttonIndex = result.response;

      if (buttonIndex === 0) {
        // Action de déconnexion
        console.log(`Déconnexion de ${currentSession}`);
        removeProfile(currentSession); // Exécute la fonction de suppression de profil
        sendNotification('Déconnexion', `Vous avez été déconnecté de ${currentSession}.`);
        if (mainWindow) {
          mainWindow.close();
        }
        createLoginWindow(); // Ouvre la fenêtre de connexion
      } else if (buttonIndex > 0 && buttonIndex <= profileslist.length) {
        // Se connecter sur un autre profil
        const selectedProfile = profileslist[buttonIndex - 1];
        console.log(`Connexion sur ${selectedProfile.login}`);

        if (currentSession === selectedProfile.login) {
          sendNotification('Info', `Vous êtes déjà connecté sur ${selectedProfile.login}.`);
          return;
        }
        
        if (mainWindow) {
          mainWindow.close();
        }
        createMainWindow(selectedProfile.url, selectedProfile.login, selectedProfile.password); // Ouvre la fenêtre principale avec le nouveau profil
      } else {
        // Annuler ou aucune action
        console.log('Action annulée');
      }
    }).catch(err => {
      console.error('Erreur lors de l\'affichage de la boîte de dialogue:', err);
    });
}

// Fonction principale qui démarre l'application
app.whenReady().then(async () => {

  globalShortcut.register('Shift+F1', async () => {
    console.log('Raccourci SHIFT + F1 activé');
    showDialog();
  });

  // Vérifier si des arguments de profil ont été fournis à l'application
  const args = process.argv.slice(1);
  const urlArg = args.find(arg => arg.startsWith('--url='));
  const loginArg = args.find(arg => arg.startsWith('--login='));
  const passwordArg = args.find(arg => arg.startsWith('--password='));

  let profileslist = [];

  // Charger les profils via async/await sans relancer l'application
  await import('electron-store').then((module) => {
    profileslist = getProfiles(); // Charger les profils
  });

  if (urlArg && loginArg && passwordArg) {
    const url = urlArg.split('=')[1];
    const login = loginArg.split('=')[1];
    const password = passwordArg.split('=')[1];
    
    // Ouvrir la fenêtre principale avec les informations fournies
    createMainWindow(url, login, password);
  } else {
    if (profileslist.length > 0) {
      // Ouvrir la fenêtre principale avec le premier profil
      createMainWindow(profileslist[0].url, profileslist[0].login, profileslist[0].password);
    } else {
      // Aucun profil, ouvrir la fenêtre de login
      createLoginWindow();
    }
  }

  // Créer le menu après l'initialisation de la fenêtre
  createMenu(profileslist);
});



// Capter l'événement 'login-data-submitted' du renderer
ipcMain.on('login-data-submitted', (event, url, login, password) => {
  addProfile(url, login, password);
  if (loginWindow) {
    loginWindow.close();
  }
  createMainWindow(url, login, password);
});

// Quitter l'application si toutes les fenêtres sont fermées
app.on('window-all-closed', () => {
  app.quit();
});