import React, { useState, useEffect } from 'react';
import { isElectron, getRuntimeMode, receiveFromMain, checkBackendConnection, restartBackend } from '../utils/electronBridge';

const ElectronInfo = () => {
  const [backendStatus, setBackendStatus] = useState({ 
    connected: false, 
    checking: false,
    error: null 
  });
  const runtimeMode = getRuntimeMode();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (isElectron()) {
      // Check backend connection when component mounts
      checkBackendConnection();
      
      const cleanup = receiveFromMain('backendStatus', (status) => {
        setBackendStatus({
          ...status,
          checking: false
        });
      });

      return cleanup;
    }
  }, []);

  const containerStyle = {
    position: 'fixed',
    bottom: '10px',
    right: '10px',
    padding: '8px 12px',
    backgroundColor: runtimeMode === 'electron' ? '#4CAF50' : '#2196F3',
    color: 'white',
    borderRadius: '4px',
    fontSize: '12px',
    opacity: expanded ? 0.95 : 0.8,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    cursor: 'pointer',
    transition: 'all 0.2s ease-in-out',
    maxWidth: expanded ? '200px' : '120px'
  };

  const buttonStyle = {
    marginTop: '6px',
    padding: '4px 8px',
    backgroundColor: '#ffffff',
    color: '#333333',
    border: 'none',
    borderRadius: '3px',
    fontSize: '10px',
    cursor: 'pointer'
  };

  // Try to connect to the backend API
  const checkConnection = () => {
    setBackendStatus(prev => ({ ...prev, checking: true }));
    
    fetch('http://localhost:5000/api/health')
      .then(response => {
        if (response.ok) {
          setBackendStatus({ connected: true, checking: false, error: null });
        } else {
          setBackendStatus({ 
            connected: false, 
            checking: false, 
            error: `Status: ${response.status}` 
          });
        }
      })
      .catch(err => {
        setBackendStatus({ 
          connected: false, 
          checking: false, 
          error: err.message 
        });
      });
  };

  const handleRestartBackend = () => {
    if (isElectron()) {
      setBackendStatus(prev => ({ ...prev, checking: true }));
      restartBackend();
    }
  };

  const handleCheckBackend = () => {
    if (isElectron()) {
      setBackendStatus(prev => ({ ...prev, checking: true }));
      checkBackendConnection();
    } else {
      checkConnection();
    }
  };

  useEffect(() => {
    // Check backend connection on component mount
    checkConnection();
    
    // Set up interval to check connection every 10 seconds
    const interval = setInterval(checkConnection, 10000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      style={containerStyle} 
      onClick={() => setExpanded(!expanded)}
    >
      <div>{runtimeMode === 'electron' ? 'Electron App' : 'Web Browser'}</div>
      
      <div style={{ 
        fontSize: '10px', 
        marginTop: '4px',
        display: 'flex',
        alignItems: 'center', 
        gap: '4px'
      }}>
        <span style={{ 
          width: '8px', 
          height: '8px', 
          borderRadius: '50%', 
          backgroundColor: backendStatus.connected ? '#4CAF50' : '#f44336',
          display: 'inline-block'
        }}></span>
        Backend: {backendStatus.checking ? 'Checking...' : backendStatus.connected ? 'Connected' : 'Disconnected'}
      </div>
      
      {expanded && (
        <div onClick={e => e.stopPropagation()} style={{ marginTop: '8px', width: '100%' }}>
          {backendStatus.error && (
            <div style={{ fontSize: '10px', color: '#ffcccc', marginBottom: '6px' }}>
              Error: {backendStatus.error}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-between' }}>
            <button 
              style={buttonStyle} 
              onClick={handleCheckBackend} 
              disabled={backendStatus.checking}
            >
              Check Backend
            </button>
            
            {isElectron() && (
              <button 
                style={buttonStyle} 
                onClick={handleRestartBackend} 
                disabled={backendStatus.checking}
              >
                Restart Backend
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ElectronInfo; 