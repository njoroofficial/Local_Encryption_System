// src/components/features/files/FileTable.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Typography,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { fetchFiles, decryptFile } from '../../../services/api';
import FilePreview from './FilePreview';
import SearchIcon from '@mui/icons-material/Search';

// File type icons mapping
const fileTypeIcons = {
  pdf: <PictureAsPdfIcon />,
  jpg: <ImageIcon />,
  jpeg: <ImageIcon />,
  png: <ImageIcon />,
  gif: <ImageIcon />,
  default: <InsertDriveFileIcon />
};

export default function FileTable({ vaultId, refreshTrigger, searchTerm = '' }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingFile, setDownloadingFile] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [decryptionKey, setDecryptionKey] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [showDecryptDialog, setShowDecryptDialog] = useState(false);
  const [decryptionError, setDecryptionError] = useState('');
  const [decrypting, setDecrypting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter files based on search term
  const filteredFiles = useMemo(() => {
    if (!searchTerm.trim()) {
      return files;
    }
    
    const lowercasedSearch = searchTerm.toLowerCase();
    return files.filter(file => 
      (file.fileName && file.fileName.toLowerCase().includes(lowercasedSearch)) ||
      (file.fileType && file.fileType.toLowerCase().includes(lowercasedSearch)) ||
      (file.uploadDate && file.uploadDate.toLowerCase().includes(lowercasedSearch)) ||
      (file.fileSize && formatFileSize(file.fileSize).toLowerCase().includes(lowercasedSearch))
    );
  }, [files, searchTerm]);

  const loadFiles = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching files for vault:', vaultId);
      const response = await fetchFiles(vaultId);
      console.log('Fetched files:', response.files);
      setFiles(response.files || []);
      setError(null);
    } catch (err) {
      console.error('Error loading files:', err);
      if (err.message === 'Vault not found' || err.message === 'Server error') {
        setError(err.message);
      } else {
        setFiles([]);
        setError(null);
      }
    } finally {
      setLoading(false);
    }
  }, [vaultId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles, refreshTrigger]);

  if (loading) return <div>Loading files...</div>;
  if (error) return <div>Error: {error}</div>;

  if (files.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 6,
          backgroundColor: '#fff',
          borderRadius: 1,
          border: '1px solid #e0e0e0',
        }}
      >
        <FolderOpenIcon sx={{ fontSize: 60, color: '#9e9e9e', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No Files Yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Upload files to get started
        </Typography>
      </Box>
    );
  }

  if (filteredFiles.length === 0 && searchTerm.trim() !== '') {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          py: 6,
          backgroundColor: '#fff',
          borderRadius: 1,
          border: '1px solid #e0e0e0',
        }}
      >
        <SearchIcon sx={{ fontSize: 60, color: '#9e9e9e', mb: 2 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No matching files found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Try a different search term
        </Typography>
      </Box>
    );
  }

  const getFileIcon = (fileType) => {
    return fileTypeIcons[fileType.toLowerCase()] || fileTypeIcons.default;
  };

  const handleDownload = async (file) => {
    setDownloadingFile(file.fileId);
    setSelectedFile(file);
    setDecryptionKey('');
    setDecryptionError('');
    setShowDecryptDialog(true);
  };

  const handleFileClick = (file) => {
    setSelectedFile(file);
    setDecryptionKey('');
    setDecryptionError('');
    setShowDecryptDialog(true);
  };

  const handlePreviewClose = () => {
    setPreviewOpen(false);
    setSelectedFile(null);
  };

  const handleDecrypt = async () => {
    if (!selectedFile || !decryptionKey) return;

    setDecrypting(true);
    setDecryptionError('');

    try {
      // Handle download case
      if (downloadingFile === selectedFile.fileId) {
        const response = await decryptFile(selectedFile.fileId, decryptionKey, true);
        
        // Create blob and trigger download
        const blob = new Blob([response], { type: getContentType(selectedFile.fileType) });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = selectedFile.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up
        URL.revokeObjectURL(url);
        setShowDecryptDialog(false);
        setDownloadingFile(null);
        return;
      }

      // Handle preview case (not a download)
      const response = await decryptFile(selectedFile.fileId, decryptionKey, false);
      let blob;

      // Handle text files
      if (selectedFile.fileType.toLowerCase() === 'txt') {
        const textContent = await response.text();
        blob = new Blob([textContent], { type: 'text/plain' });
      } else {
        // Handle other file types
        blob = new Blob([response], { type: getContentType(selectedFile.fileType) });
      }

      const url = URL.createObjectURL(blob);

      // Update state for preview
      setShowDecryptDialog(false);
      setSelectedFile({
        ...selectedFile,
        decryptedUrl: url,
        textContent: selectedFile.fileType.toLowerCase() === 'txt' ? await blob.text() : null
      });
      setPreviewOpen(true);

    } catch (error) {
      console.error('Decryption error:', error);
      setDecryptionError(error.message || 'Failed to decrypt file');
    } finally {
      setDecrypting(false);
    }
  };

  // Helper function to get content type
  const getContentType = (fileType) => {
    const contentTypes = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'txt': 'text/plain',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    return contentTypes[fileType.toLowerCase()] || 'application/octet-stream';
  };

  const handleDeleteClick = async (e, file) => {
    e.stopPropagation(); // Prevent row click event
    setFileToDelete(file);
    setDecryptionKey('');
    setVerificationMessage('');
    setVerificationError('');
    setIsVerified(false);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;

    if (!isVerified) {
      // First step: Verify the decryption key
      setIsVerifying(true);
      setVerificationError('');
      setVerificationMessage('');
      
      try {
        // Import the verifyFileDelete function
        const { verifyFileDelete } = await import('../../../services/api');
        
        // Verify the decryption key
        const result = await verifyFileDelete(fileToDelete.fileId, decryptionKey);
        
        // Set verification message with file details
        setVerificationMessage(`Verification successful. Delete "${result.file.file_name}" from ${result.file.vault_name}?`);
        setIsVerified(true);
      } catch (error) {
        console.error('Verification error:', error);
        
        // Display a user-friendly error message
        if (error.message.includes('Encryption key not found')) {
          setVerificationError('File encryption key could not be found. This may be due to a database inconsistency.');
        } else if (error.message.includes('Invalid decryption key')) {
          setVerificationError('The decryption key you entered is incorrect. Please try again.');
        } else {
          setVerificationError(error.message || 'Verification failed. Please try again later.');
        }
      } finally {
        setIsVerifying(false);
      }
      return;
    }

    // Second step: Delete the file after verification
    setIsDeleting(true);
    try {
      // Import the deleteFile function
      const { deleteFile } = await import('../../../services/api');
      
      // Delete the file
      await deleteFile(fileToDelete.fileId);

      // Remove file from the list
      setFiles(files.filter(f => f.fileId !== fileToDelete.fileId));
      setDeleteDialogOpen(false);
      
      // Show success notification (you can implement this)
      // showNotification('File deleted successfully');
    } catch (error) {
      console.error('Delete error:', error);
      setVerificationError(error.message);
    } finally {
      setIsDeleting(false);
      setIsVerified(false);
      setDecryptionKey('');
    }
  };

  return (
    <>
      <TableContainer 
        component={Paper}
        sx={{
          border: '1px solid #e0e0e0',
          boxShadow: 'none',
          borderRadius: 1,
        }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell>File Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>Uploaded</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredFiles.map((file) => (
              <TableRow 
                key={file.fileId}
                onClick={() => handleFileClick(file)}
                sx={{ 
                  '&:hover': { backgroundColor: '#f8f8f8' },
                  cursor: 'pointer'
                }}
              >
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getFileIcon(file.fileType)}
                    <Typography>{file.fileName}</Typography>
                  </Box>
                </TableCell>
                <TableCell>{file.fileType.toUpperCase()}</TableCell>
                <TableCell>{formatFileSize(file.fileSize)}</TableCell>
                <TableCell>{new Date(file.createdAt).toLocaleString()}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Preview">
                    <IconButton 
                      size="small"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        // Initialize preview decryption
                        setSelectedFile(file);
                        setDecryptionKey('');
                        setDecryptionError('');
                        setShowDecryptDialog(true);
                      }}
                    >
                      <VisibilityIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Download">
                    <IconButton 
                      size="small"
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleDownload(file); 
                      }}
                      disabled={downloadingFile === file.fileId}
                    >
                      {downloadingFile === file.fileId ? (
                        <CircularProgress size={20} />
                      ) : (
                        <DownloadIcon />
                      )}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton 
                      size="small"
                      onClick={(e) => handleDeleteClick(e, file)}
                      disabled={isDeleting && fileToDelete?.fileId === file.fileId}
                    >
                      {isDeleting && fileToDelete?.fileId === file.fileId ? (
                        <CircularProgress size={20} />
                      ) : (
                        <DeleteIcon />
                      )}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Encrypted">
                    <LockIcon 
                      sx={{ 
                        ml: 1, 
                        color: 'primary.main',
                        fontSize: '1.2rem'
                      }} 
                    />
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Decryption Dialog */}
      <Dialog open={showDecryptDialog} onClose={() => setShowDecryptDialog(false)}>
        <DialogTitle>Enter Decryption Key</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Please enter the decryption key for "{selectedFile?.fileName}"
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Decryption Key"
            type="password"
            fullWidth
            value={decryptionKey}
            onChange={(e) => setDecryptionKey(e.target.value)}
            error={!!decryptionError}
            helperText={decryptionError}
            disabled={decrypting}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDecryptDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleDecrypt}
            variant="contained"
            disabled={!decryptionKey || decrypting}
          >
            {decrypting ? 'Decrypting...' : 'Decrypt'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Dialog */}
      <FilePreview
        file={selectedFile}
        open={previewOpen}
        onClose={handlePreviewClose}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !isDeleting && !isVerifying && setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete File</DialogTitle>
        <DialogContent>
          {!isVerified ? (
            <>
              <Typography gutterBottom>
                To delete the file "{fileToDelete?.fileName}", please enter your decryption key.
              </Typography>
              <TextField
                autoFocus
                margin="dense"
                label="Decryption Key"
                type="password"
                fullWidth
                value={decryptionKey}
                onChange={(e) => setDecryptionKey(e.target.value)}
                disabled={isVerifying}
                error={!!verificationError}
                helperText={verificationError}
              />
            </>
          ) : (
            <Typography>
              {verificationMessage}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setDeleteDialogOpen(false);
              setIsVerified(false);
              setDecryptionKey('');
            }}
            disabled={isDeleting || isVerifying}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            disabled={isDeleting || isVerifying || (!isVerified && !decryptionKey)}
          >
            {isVerifying 
              ? 'Verifying...' 
              : isDeleting 
                ? 'Deleting...' 
                : isVerified 
                  ? 'Confirm Delete' 
                  : 'Verify'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}