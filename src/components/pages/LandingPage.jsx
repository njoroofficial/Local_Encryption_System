import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import "../../styles/landingPage.css";
import EnhancedEncryptionIcon from "@mui/icons-material/EnhancedEncryption";
import { testBackendConnection } from '../../services/api';

function LandingPage() {
  const navigate = useNavigate();
  const [connectionStatus, setConnectionStatus] = useState('');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const data = await testBackendConnection();
        setConnectionStatus(data.message);
      } catch (error) {
        setConnectionStatus('Failed to connect to backend');
      }
    };

    checkConnection();
  }, []);

  return (
    <div className="landing-container">
      <nav className="landing-nav">
        <div className="logo">
          <EnhancedEncryptionIcon />
          Local Encryption and Storage Management System
        </div>

      </nav>

      <main className="hero-section">
        <div className="hero-content">
          <h1>Secure Your Files with Local Encryption</h1>
          <p>
            Store and manage your sensitive files with military-grade
            encryption, right on your local system.
          </p>
          <div className="cta-buttons">
            <button 
              onClick={() => navigate("/SignUp")} 
              className="primary-btn"
            >
              Get Started
            </button>
            <button 
              onClick={() => navigate("/SignIn")} 
              className="secondary-btn"
            >
              Login
            </button>
          </div>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <i className="fas fa-lock"></i>
            <h3>Local Encryption</h3>
            <p>
              Your files never leave your system. Everything is encrypted
              locally.
            </p>
          </div>
          <div className="feature-card">
            <i className="fas fa-file-alt"></i>
            <h3>File Management</h3>
            <p>Organize and manage your encrypted files with ease.</p>
          </div>
          <div className="feature-card">
            <i className="fas fa-key"></i>
            <h3>Secure Access</h3>
            <p>Access your files quickly with secure decryption.</p>
          </div>
          <div className="feature-card">
            <i className="fas fa-history"></i>
            <h3>Version Control</h3>
            <p>Keep track of file changes and maintain versions.</p>
          </div>
        </div>
      </main>
      <div style={{ position: 'fixed', bottom: 10, right: 10, fontSize: '12px' }}>
        {connectionStatus && <p>Status: {connectionStatus}</p>}
      </div>
    </div>
  );
}

export default LandingPage;
