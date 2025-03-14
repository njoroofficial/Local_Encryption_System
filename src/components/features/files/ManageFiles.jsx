// src/components/features/files/ManageFiles.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import UploadSection from './UploadSection';
import FileTable from './FileTable';
import '../../../styles/main.css';

function ManageFiles() {
  const { vaultId } = useParams();
  const [loading, setLoading] = useState(true);
  const [vaultName, setVaultName] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    // Get the vault name from localStorage or state management
    const getVaultName = () => {
      try {
        const vaultData = JSON.parse(localStorage.getItem('currentVault'));
        if (vaultData && vaultData.name) {
          setVaultName(vaultData.name);
        }
      } catch (err) {
        console.error('Error getting vault name:', err);
      }
      setLoading(false);
    };

    getVaultName();
  }, [vaultId]);

  const handleFileUploaded = useCallback(() => {
    // Increment refresh trigger to force FileTable to reload
    setRefreshTrigger(prev => prev + 1);
  }, []);

  if (loading) return <div>Loading files...</div>;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {vaultName ? `${vaultName} - Files` : 'Manage Files'}
      </Typography>
      <div className="manage-files-container">
        <div className="manage-files-card">
          <h1 className="manage-files-title">Manage Your Files</h1>
          <p className="manage-files-subtitle">
            Upload, download, and organize your encrypted files
          </p>
          <UploadSection vaultId={vaultId} onFileUploaded={handleFileUploaded} />
          <FileTable vaultId={vaultId} refreshTrigger={refreshTrigger} />
        </div>
      </div>
    </Box>
  );
}

export default ManageFiles;