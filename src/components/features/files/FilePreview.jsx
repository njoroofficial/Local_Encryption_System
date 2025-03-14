import React, { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  CircularProgress,
  Button,
  Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';

export default function FilePreview({ file, open, onClose }) {
  const fileType = file?.fileType?.toLowerCase();
  
  // Group file types
  const isImage = ['jpg', 'jpeg', 'png'].includes(fileType);
  const isPDF = fileType === 'pdf';
  const isText = fileType === 'txt';
  const isDoc = ['doc', 'docx'].includes(fileType);
  const isSpreadsheet = ['xls', 'xlsx'].includes(fileType);
  const isPresentation = ['ppt', 'pptx'].includes(fileType);

  // Clean up the blob URL when closing the preview
  useEffect(() => {
    return () => {
      if (file?.decryptedUrl) {
        URL.revokeObjectURL(file.decryptedUrl);
      }
    };
  }, [file]);

  const renderPreview = () => {
    if (!file?.decryptedUrl) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      );
    }

    // Image preview
    if (isImage) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <img
            src={file.decryptedUrl}
            alt={file.fileName}
            style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
          />
        </Box>
      );
    }

    // PDF preview
    if (isPDF) {
      return (
        <Box sx={{ width: '100%', height: '80vh' }}>
          <object
            data={file.decryptedUrl}
            type="application/pdf"
            width="100%"
            height="100%"
          >
            <iframe
              src={file.decryptedUrl}
              width="100%"
              height="100%"
              style={{ border: 'none' }}
              title={file.fileName}
            >
              This browser does not support PDFs. Please download to view it.
            </iframe>
          </object>
        </Box>
      );
    }

    // Text file preview
    if (isText) {
      return (
        <Paper 
          sx={{ 
            p: 3, 
            maxHeight: '80vh', 
            overflow: 'auto',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            fontSize: '14px',
            lineHeight: 1.5
          }}
        >
          <pre style={{ margin: 0 }}>
            {file.textContent}
          </pre>
        </Paper>
      );
    }

    // Office documents preview
    if (isDoc || isSpreadsheet || isPresentation) {
      const googleDocsViewer = `https://docs.google.com/gview?url=${encodeURIComponent(file.decryptedUrl)}&embedded=true`;
      return (
        <Box sx={{ height: '80vh', width: '100%' }}>
          <iframe
            src={googleDocsViewer}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title={file.fileName}
          />
        </Box>
      );
    }

    // Fallback for unsupported file types
    return (
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        p: 4 
      }}>
        {getFileIcon()}
        <Typography variant="h6" sx={{ mt: 2 }}>
          Preview not available for this file type
        </Typography>
        <Button
          variant="contained"
          href={file.decryptedUrl}
          download={file.fileName}
          sx={{ mt: 2 }}
        >
          Download File
        </Button>
      </Box>
    );
  };

  const getFileIcon = () => {
    if (isDoc) return <DescriptionIcon sx={{ fontSize: 80, color: '#4285F4' }} />;
    if (isSpreadsheet) return <TableChartIcon sx={{ fontSize: 80, color: '#0F9D58' }} />;
    if (isPresentation) return <SlideshowIcon sx={{ fontSize: 80, color: '#F4B400' }} />;
    if (isText) return <TextSnippetIcon sx={{ fontSize: 80, color: 'text.secondary' }} />;
    return <InsertDriveFileIcon sx={{ fontSize: 80, color: 'text.secondary' }} />;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          height: '90vh',
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {getFileIcon()}
          <Typography sx={{ flex: 1 }}>{file?.fileName}</Typography>
          <IconButton
            onClick={onClose}
            sx={{ ml: 2 }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {renderPreview()}
      </DialogContent>
    </Dialog>
  );
} 