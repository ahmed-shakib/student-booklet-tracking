const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
    titleBarStyle: 'default',
    title: 'Student Booklet Tracker',
  });

  const isDev = process.env['ELECTRON_DEV'] === 'true';

  if (isDev) {
    mainWindow.loadURL('http://localhost:4200');
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(app.getAppPath(), 'dist', 'student-booklet-tracking', 'browser', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in the default browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (targetUrl.startsWith('http')) {
      shell.openExternal(targetUrl);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  buildMenu();

  // Log file IPC handler
  ipcMain.on('append-log', (_event, entry) => {
    try {
      const logDir = app.getPath('userData');
      const logFile = path.join(logDir, 'change_log.txt');
      fs.appendFileSync(logFile, entry + '\n', 'utf8');
    } catch (e) {
      // silently ignore log write errors
    }
  });
});

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'quit', label: 'Exit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (!mainWindow) return;
            const isDev = process.env['ELECTRON_DEV'] === 'true';
            if (isDev) {
              mainWindow.loadURL('http://localhost:4200');
            } else {
              const indexPath = path.join(app.getAppPath(), 'dist', 'student-booklet-tracking', 'browser', 'index.html');
              mainWindow.loadFile(indexPath);
            }
          }
        },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Student Booklet Tracker',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Student Booklet Tracker',
              message: 'Student Booklet Tracker',
              detail: 'Version 1.1.0\n\u00a9 Shakib Ahmed, Best Brains Barrhaven Center\n\nTrack Math & English booklet levels and weeks for students.',
              buttons: ['OK'],
            });
          }
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
