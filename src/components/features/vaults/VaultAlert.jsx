// src/components/features/vault/VaultAlert.jsx
import React from 'react';

function VaultAlert() {
  return (
    <div className="vault-alert">
      <div className="alert-header">
        <span role="img" aria-label="information" className="alert-icon">
          ℹ️
        </span>
        <span className="alert-title">Important</span>
      </div>
      <p className="alert-message">
        Your encryption key is used to secure your vault. Make sure to remember it, as it cannot be recovered if lost.
      </p>
    </div>
  );
}

export default VaultAlert;