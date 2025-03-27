/**
 * Electron API Bridge
 * Provides safe access to Electron IPC renderer process API
 * Falls back to dummy implementation when running in a browser
 */

// Check if we're running in Electron
const isElectron = () => {
  return window && window.electron;
};

// Send message to main process
const sendToMain = (channel, data) => {
  if (isElectron()) {
    window.electron.send(channel, data);
  } else {
    console.log(`[Browser Mode] sendToMain: ${channel}`, data);
  }
};

// Register handler for messages from main process
const receiveFromMain = (channel, func) => {
  if (isElectron()) {
    window.electron.receive(channel, func);
    return () => window.electron.removeAllListeners(channel);
  } else {
    console.log(`[Browser Mode] receiveFromMain handler registered for: ${channel}`);
    return () => {};
  }
};

// Check backend connection status
const checkBackendConnection = () => {
  if (isElectron()) {
    sendToMain('checkBackendConnection');
  }
};

// Request restart of backend
const restartBackend = () => {
  if (isElectron()) {
    sendToMain('restartBackend');
  }
};

// Get application runtime mode
const getRuntimeMode = () => {
  if (isElectron()) {
    return 'electron';
  }
  return 'browser';
};

export {
  isElectron,
  sendToMain,
  receiveFromMain,
  checkBackendConnection,
  restartBackend,
  getRuntimeMode
}; 