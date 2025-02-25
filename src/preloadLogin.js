const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    let saveButton = document.getElementById('save-button');
    saveButton.addEventListener('click', () => {
        console.log('Clic sur le bouton "Sauvegarder"'); // Debug : clic sur le bouton "Sauvegarder"
        let url = document.getElementById('url').value;
        let login = document.getElementById('username').value;
        let password = document.getElementById('password').value;
        ipcRenderer.send('login-data-submitted', url, login, password);
    })
});