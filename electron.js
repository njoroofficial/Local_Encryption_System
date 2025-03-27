const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';
const { spawn } = require('child_process');
const http = require('http');
let backendProcess = null;
let mainWindow = null;

// Function to check if the backend is running and accessible
function checkBackendConnection(callback) {
  const options = {
    host: 'localhost',
    port: 5000,
    path: '/api/health',
    method: 'GET',
    timeout: 2000
  };

  const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
      console.log('Backend health check: OK');
      callback(true);
    } else {
      console.log(`Backend health check failed with status: ${res.statusCode}`);
      callback(false);
    }
  });

  req.on('error', (err) => {
    console.log(`Backend connection error: ${err.message}`);
    callback(false);
  });

  req.on('timeout', () => {
    req.destroy();
    console.log('Backend connection timeout');
    callback(false);
  });

  req.end();
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the app
  const startURL = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, './build/index.html')}`;

  mainWindow.loadURL(startURL);

  // Open DevTools in development mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Set app to maximize and center
  mainWindow.maximize();
  
  // Set up IPC handlers
  setupIPC();
}

function startBackendServer() {
  if (isDev) {
    // In development, we don't need to start the backend here
    console.log('Backend should be started separately in development mode');
    return;
  }

  // Path to the backend directory relative to the electron.js file
  const backendDir = isDev 
    ? path.join(__dirname, 'backend')
    : path.join(process.resourcesPath, 'backend');
  
  // Start the backend server
  // Note: Since backend uses ES modules, we need to use the --experimental-modules flag
  backendProcess = spawn('node', ['server.js'], {
    cwd: backendDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  
  backendProcess.on('error', (err) => {
    console.error('Failed to start backend server:', err);
  });
  
  console.log('Backend server started');
}

// Set up IPC handlers for communication with renderer process
function setupIPC() {
  // Handler for checking backend connection
  ipcMain.on('checkBackendConnection', () => {
    checkBackendConnection((connected) => {
      if (mainWindow) {
        mainWindow.webContents.send('backendStatus', { 
          connected: connected,
          error: connected ? null : 'Backend connection failed' 
        });
      }
    });
  });
  
  // Handler for restarting the backend (only relevant in production)
  ipcMain.on('restartBackend', () => {
    if (!isDev && backendProcess) {
      console.log('Restarting backend server...');
      backendProcess.kill();
      backendProcess = null;
      
      // Wait a bit before restarting
      setTimeout(() => {
        startBackendServer();
        
        // Check if it worked
        setTimeout(() => {
          checkBackendConnection((connected) => {
            if (mainWindow) {
              mainWindow.webContents.send('backendStatus', { 
                connected: connected,
                error: connected ? null : 'Backend restart failed' 
              });
            }
          });
        }, 2000);
      }, 1000);
    } else {
      console.log('Backend restart only available in production mode');
    }
  });
}

// When Electron has finished initialization
app.whenReady().then(() => {
  if (!isDev) {
    startBackendServer();
  }
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Clean up backend process when app is quitting
app.on('quit', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}); 