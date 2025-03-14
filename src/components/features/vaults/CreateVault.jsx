// src/components/features/vault/CreateVault.jsx
import React from 'react';
import CreateVaultForm from './CreateVaultForm';
import '../../../styles/createvault.css';

function CreateVault() {
  return (
    <div className="create-vault-container">
      <div className="create-vault-card">
        <h1 className="create-vault-title">Create a New Vault</h1>
        <p className="create-vault-subtitle">
          Set up a secure space for your encrypted files
        </p>
        <CreateVaultForm />
      </div>
    </div>
  );
}

export default CreateVault;