// src/components/features/vault/VaultManager/VaultTable.jsx

import React, { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField
} from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import LockIcon from "@mui/icons-material/Lock";
import DeleteIcon from "@mui/icons-material/Delete";
import { useNavigate } from "react-router-dom";
import { deleteVault, verifyVaultKey } from "../../../../services/api";

export default function VaultTable({ vaults = [], onVaultDeleted }) {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vaultToDelete, setVaultToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Add new state for key verification
  const [keyVerificationOpen, setKeyVerificationOpen] = useState(false);
  const [selectedVault, setSelectedVault] = useState(null);
  const [vaultKey, setVaultKey] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  // Add these new states after the existing ones
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showUserVerification, setShowUserVerification] = useState(false);
  const [userCredentials, setUserCredentials] = useState({ email: '', password: '' });

  const handleVaultClick = (vault) => {
    setSelectedVault(vault);
    setKeyVerificationOpen(true);
    setVaultKey('');
    setVerificationError('');
  };

  const handleKeyVerification = async () => {
    if (!selectedVault || !vaultKey) return;

    setVerifying(true);
    setVerificationError('');

    try {
      const response = await verifyVaultKey(selectedVault.id, vaultKey);
      setKeyVerificationOpen(false);
      setFailedAttempts(0);
      
      // Store complete vault data including the key
      localStorage.setItem('currentVault', JSON.stringify({
        ...response.vault,
        vault_key: vaultKey // Store the vault key
      }));
      
      navigate(`/vault/${selectedVault.id}/files`);
    } catch (error) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      
      if (newAttempts >= 3) {
        setShowUserVerification(true);
        setVerificationError('Too many failed attempts. Please verify your identity.');
      } else {
        setVerificationError(`Invalid vault key. ${3 - newAttempts} attempts remaining.`);
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleUserVerification = async () => {
    if (!selectedVault || !userCredentials.email || !userCredentials.password) return;

    setVerifying(true);
    setVerificationError('');

    try {
      const response = await verifyVaultKey(selectedVault.id, null, userCredentials);
      setKeyVerificationOpen(false);
      setShowUserVerification(false);
      setFailedAttempts(0);
      
      // Store complete vault data including the key
      localStorage.setItem('currentVault', JSON.stringify(response.vault));
      
      navigate(`/vault/${selectedVault.id}/files`);
    } catch (error) {
      setVerificationError('Invalid credentials. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleDeleteClick = (e, vault) => {
    e.stopPropagation();
    setVaultToDelete(vault);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!vaultToDelete) return;

    setIsDeleting(true);
    try {
      const userData = JSON.parse(localStorage.getItem('userData'));
      if (!userData || !userData.userId) {
        throw new Error('User not authenticated');
      }
      await deleteVault(vaultToDelete.vault_id || vaultToDelete.id, userData.userId);
      setDeleteDialogOpen(false);
      if (onVaultDeleted) {
        onVaultDeleted(vaultToDelete.vault_id || vaultToDelete.id);
      }
    } catch (error) {
      console.error('Failed to delete vault:', error);
      alert('Failed to delete vault. Please try again.');
    } finally {
      setIsDeleting(false);
      setVaultToDelete(null);
    }
  };

  return (
    <>
      <TableContainer 
        component={Paper} 
        sx={{ 
          borderRadius: 2,
          border: '1px solid #f3f4f6',
          boxShadow: 'none'
        }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f9fafb' }}>
              <TableCell>Vault Name</TableCell>
              <TableCell>Created Date</TableCell>
              <TableCell>Files</TableCell>
              <TableCell>Last Accessed</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {vaults.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No vaults found. Create your first vault!
                </TableCell>
              </TableRow>
            ) : (
              vaults.map((vault) => (
                <TableRow 
                  key={vault.id}
                  onClick={() => handleVaultClick(vault)}
                  sx={{ 
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: '#f9fafb' }
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FolderIcon sx={{ color: '#6b7280' }} />
                      <span>{vault.name}</span>
                    </Box>
                  </TableCell>
                  <TableCell>{vault.createdAt}</TableCell>
                  <TableCell>{vault.filesCount} files</TableCell>
                  <TableCell>{vault.lastAccessed}</TableCell>
                  <TableCell align="right">
                    <IconButton 
                      size="small"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <LockIcon sx={{ color: '#6b7280' }} />
                    </IconButton>
                    <IconButton 
                      size="small"
                      onClick={(e) => handleDeleteClick(e, vault)}
                      sx={{
                        '&:hover': {
                          color: 'error.main'
                        }
                      }}
                    >
                      <DeleteIcon sx={{ color: '#6b7280' }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Key Verification Dialog */}
      <Dialog
        open={keyVerificationOpen}
        onClose={() => !verifying && setKeyVerificationOpen(false)}
      >
        <DialogTitle sx={{ pb: 1 }}>Enter Vault Key</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Please enter the encryption key for vault "{selectedVault?.name}"
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Vault Key"
            type="password"
            fullWidth
            value={vaultKey}
            onChange={(e) => setVaultKey(e.target.value)}
            error={!!verificationError}
            helperText={verificationError}
            disabled={verifying}
            inputProps={{ 
              autoComplete: "new-password"
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button 
            onClick={() => setKeyVerificationOpen(false)}
            disabled={verifying}
          >
            Cancel
          </Button>
          <Button
            onClick={handleKeyVerification}
            variant="contained"
            disabled={!vaultKey || verifying}
          >
            {verifying ? 'Verifying...' : 'Access Vault'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={keyVerificationOpen && showUserVerification}
        onClose={() => !verifying && setKeyVerificationOpen(false)}
      >
        <DialogTitle sx={{ pb: 1 }}>Verify Your Identity</DialogTitle>
        <DialogContent>
          <Typography gutterBottom color="error">
            Too many failed attempts. Please verify your identity to access the vault.
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Email"
            type="email"
            fullWidth
            value={userCredentials.email}
            onChange={(e) => setUserCredentials(prev => ({ ...prev, email: e.target.value }))}
            disabled={verifying}
            inputProps={{ 
              autoComplete: "off"
            }}
          />
          <TextField
            margin="dense"
            label="Password"
            type="password"
            fullWidth
            value={userCredentials.password}
            onChange={(e) => setUserCredentials(prev => ({ ...prev, password: e.target.value }))}
            error={!!verificationError}
            helperText={verificationError}
            disabled={verifying}
            inputProps={{ 
              autoComplete: "new-password"
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button 
            onClick={() => {
              setKeyVerificationOpen(false);
              setShowUserVerification(false);
              setFailedAttempts(0);
            }}
            disabled={verifying}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUserVerification}
            variant="contained"
            disabled={!userCredentials.email || !userCredentials.password || verifying}
          >
            {verifying ? 'Verifying...' : 'Verify Identity'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => !isDeleting && setDeleteDialogOpen(false)}
      >
        <DialogTitle sx={{ pb: 1 }}>Delete Vault</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the vault "{vaultToDelete?.name}"? 
            This action cannot be undone and all files in this vault will be permanently deleted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1 }}>
          <Button 
            onClick={() => setDeleteDialogOpen(false)} 
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
