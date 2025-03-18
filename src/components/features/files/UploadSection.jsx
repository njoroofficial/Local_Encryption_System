import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  LinearProgress,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { uploadFile } from '../../../services/api';

export default function UploadSection({ vaultId, onFileUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showEncryptDialog, setShowEncryptDialog] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState('');
  const [useVaultKey, setUseVaultKey] = useState(false);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      console.log('File selected:', file.name);
      setSelectedFile(file);
      setShowEncryptDialog(true);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    if (!useVaultKey && !encryptionKey) {
      setError('Please provide an encryption key');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(false);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      // Make sure vaultId is available
      if (!vaultId) {
        throw new Error('Vault ID is missing');
      }
      formData.append('vault_id', vaultId);
      
      // Get user data from localStorage
      const userData = JSON.parse(localStorage.getItem('userData'));
      if (!userData || !userData.userId) {
        throw new Error('User ID not found. Please log in again.');
      }
      formData.append('user_id', userData.userId);
      
      let key;
      if (useVaultKey) {
        const vaultData = JSON.parse(localStorage.getItem('currentVault'));
        if (!vaultData || !vaultData.vault_key) {
          throw new Error('Vault key not found. Please unlock the vault first.');
        }
        key = vaultData.vault_key;
      } else {
        if (!encryptionKey) {
          throw new Error('Please provide an encryption key');
        }
        key = encryptionKey;
      }

      // Log upload details (excluding sensitive data)
      console.log('Preparing upload:', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        vaultId,
        userId: userData.userId,
        useVaultKey,
        hasKey: !!key,
        keyLength: key ? key.length : 0
      });

      formData.append('encryption_key', key);
      formData.append('use_vault_key', useVaultKey.toString());

      const response = await uploadFile(formData, (progress) => {
        setUploadProgress(progress);
      });

      console.log('Upload response:', response);
      setSuccess(true);
      setShowEncryptDialog(false);
      setSelectedFile(null);
      setEncryptionKey('');
      setUseVaultKey(false);
      
      if (onFileUploaded) {
        onFileUploaded();
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleDialogClose = () => {
    setShowEncryptDialog(false);
    setSelectedFile(null);
    setEncryptionKey('');
    setUseVaultKey(false);
  };

  return (
    <Box sx={{ mb: 4 }}>
      <Card>
        <CardContent>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            mb: 3 
          }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Upload File
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Select a file to encrypt and upload
              </Typography>
            </Box>
            <Box>
              <input
                type="file"
                id="file-upload"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
                disabled={uploading}
              />
              <label htmlFor="file-upload">
                <Button
                  variant="contained"
                  component="span"
                  startIcon={<CloudUploadIcon />}
                  disabled={uploading}
                >
                  {uploading ? 'Uploading...' : 'Select File'}
                </Button>
              </label>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Encryption Dialog */}
      <Dialog open={showEncryptDialog} onClose={handleDialogClose}>
        <DialogTitle>Set Encryption Key</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Please provide an encryption key for your file or use the vault's key.
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={useVaultKey}
                onChange={(e) => setUseVaultKey(e.target.checked)}
              />
            }
            label="Use Vault's Encryption Key"
          />
          {!useVaultKey && (
            <TextField
              autoFocus
              margin="dense"
              label="Encryption Key"
              type="password"
              fullWidth
              value={encryptionKey}
              onChange={(e) => setEncryptionKey(e.target.value)}
              disabled={useVaultKey}
              required
            />
          )}
          <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
            Important: Keep this key safe. You'll need it to decrypt the file later.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button 
            onClick={handleUpload}
            variant="contained"
            disabled={!useVaultKey && !encryptionKey}
          >
            Upload & Encrypt
          </Button>
        </DialogActions>
      </Dialog>

      {uploading && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Uploading: {uploadProgress}%
          </Typography>
          <LinearProgress variant="determinate" value={uploadProgress} />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mt: 2 }}>
          File uploaded and encrypted successfully!
        </Alert>
      )}
    </Box>
  );
}