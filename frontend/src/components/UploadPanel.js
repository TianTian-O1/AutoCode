import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadFile } from '../services/api';
import { 
  Button, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Stack,
  LinearProgress,
  Typography,
  Box,
  Alert,
  IconButton,
  Paper
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FolderIcon from '@mui/icons-material/Folder';
import CloseIcon from '@mui/icons-material/Close';

const UploadPanel = ({ onUploadSuccess = () => {}, onClose }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  const processFiles = async (files) => {
    let processed = 0;
    const results = {
      successful: [],
      failed: [],
      skipped: []
    };

    try {
      const fileArray = Array.from(files).sort((a, b) => {
        const pathA = (a.webkitRelativePath || a.path || a.name).toLowerCase();
        const pathB = (b.webkitRelativePath || b.path || b.name).toLowerCase();
        return pathA.localeCompare(pathB);
      });

      for (const file of fileArray) {
        try {
          const relativePath = file.webkitRelativePath || file.path || '';
          let uploadPath = '';

          if (relativePath) {
            const parts = relativePath.split('/');
            if (parts.length > 1) {
              uploadPath = parts.slice(1, -1).join('/');
            }
          }

          console.log(`Processing file: ${file.name} in path: ${uploadPath}`);
          const result = await uploadFile(file, uploadPath);
          
          results.successful.push({ 
            file: uploadPath ? `${uploadPath}/${file.name}` : file.name,
            result 
          });
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          results.failed.push({ 
            file: file.webkitRelativePath || file.path || file.name,
            error: error.message || 'Unknown error occurred'
          });
        }
        
        processed++;
        setProgress((processed / fileArray.length) * 100);
      }

      if (results.successful.length > 0) {
        console.log('Some files uploaded successfully, triggering success callback');
        onUploadSuccess();
      }

      return results;
    } catch (error) {
      console.error('Error processing files:', error);
      results.failed.push({
        file: 'batch upload',
        error: error.message || 'Unknown error occurred'
      });
      return results;
    }
  };

  const handleUploadComplete = useCallback(() => {
    if (onUploadSuccess) {
      onUploadSuccess();
    }
    setUploadStatus(null);
    setProgress(0);
    setError(null);
  }, [onUploadSuccess]);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    setUploading(true);
    setUploadStatus(null);
    setProgress(0);
    setError(null);

    try {
      console.log(`Starting upload of ${acceptedFiles.length} files`);
      const results = await processFiles(acceptedFiles);
      
      console.log('Final upload results:', results);
      setUploadStatus({
        successful: results.successful.length,
        failed: results.failed.map(f => `${f.file}: ${f.error}`),
        skipped: results.skipped.map(f => `${f.file}: ${f.reason}`),
        details: results
      });

      if (results.successful.length > 0) {
        console.log('Files uploaded successfully, triggering success callback');
        setTimeout(() => {
          onUploadSuccess();
        }, 500);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Unknown error occurred');
    } finally {
      setUploading(false);
    }
  }, [onUploadSuccess]);

  const handleFileSelect = (isFolder = false) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    
    if (isFolder) {
      input.webkitdirectory = true;
      input.directory = true;
    }

    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        onDrop(files);
      }
    };

    input.click();
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: uploading,
    noDrag: uploading
  });

  return (
    <Dialog 
      open={true}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { minHeight: '50vh' }
      }}
    >
      <DialogTitle>
        Upload Files
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ p: 2 }}>
          <Stack spacing={2} direction="column" alignItems="center">
            {error && (
              <Alert 
                severity="error" 
                onClose={() => setError(null)}
                sx={{ width: '100%', mb: 2 }}
              >
                {error}
              </Alert>
            )}

            {/* Dropzone */}
            <Paper
              {...getRootProps()}
              sx={{
                width: '100%',
                p: 3,
                textAlign: 'center',
                cursor: uploading ? 'not-allowed' : 'pointer',
                bgcolor: isDragActive ? 'action.hover' : 'background.paper',
                border: '2px dashed',
                borderColor: isDragActive ? 'primary.main' : 'divider',
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              <input {...getInputProps()} />
              <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                {uploading ? 'Uploading...' : 'Drag & drop files or folders here'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isDragActive
                  ? 'Drop the files or folders here...'
                  : 'or use the buttons below'}
              </Typography>
            </Paper>

            {/* Upload Buttons */}
            <Stack direction="row" spacing={2} sx={{ width: '100%' }}>
              <Button
                variant="contained"
                startIcon={<CloudUploadIcon />}
                onClick={() => handleFileSelect(false)}
                disabled={uploading}
                fullWidth
              >
                Upload Files
              </Button>
              <Button
                variant="contained"
                startIcon={<FolderIcon />}
                onClick={() => handleFileSelect(true)}
                disabled={uploading}
                fullWidth
              >
                Upload Folder
              </Button>
            </Stack>

            {/* Upload Progress */}
            {uploading && (
              <Box sx={{ width: '100%', mt: 2 }}>
                <LinearProgress variant="determinate" value={progress} />
                <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                  {Math.round(progress)}%
                </Typography>
              </Box>
            )}
          </Stack>
        </Box>

        {/* Results */}
        {uploadStatus && (
          <Box sx={{ mt: 2, p: 2 }}>
            {/* Summary */}
            <Stack spacing={1}>
              {uploadStatus.successful > 0 && (
                <Typography variant="subtitle1" color="success.main">
                  Successfully uploaded: {uploadStatus.successful} files
                </Typography>
              )}
              {uploadStatus.failed.length > 0 && (
                <Typography variant="subtitle1" color="error">
                  Failed: {uploadStatus.failed.length} files
                </Typography>
              )}
            </Stack>

            {/* Failed uploads */}
            {uploadStatus.failed.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" color="error" gutterBottom>
                  Failed uploads:
                </Typography>
                <Box sx={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto', 
                  border: '1px solid rgba(255, 0, 0, 0.2)',
                  borderRadius: 1,
                  p: 2,
                  bgcolor: 'rgba(255, 0, 0, 0.05)'
                }}>
                  {uploadStatus.failed.map((error, index) => (
                    <Typography 
                      key={index} 
                      variant="body2" 
                      color="error" 
                      sx={{ 
                        mb: 1,
                        '&:last-child': { mb: 0 },
                        wordBreak: 'break-word'
                      }}
                    >
                      {error}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}

            {/* Successful uploads */}
            {uploadStatus.details?.successful.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h6" color="success.main" gutterBottom>
                  Successfully uploaded files:
                </Typography>
                <Box sx={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto',
                  border: '1px solid rgba(0, 255, 0, 0.2)',
                  borderRadius: 1,
                  p: 2,
                  bgcolor: 'rgba(0, 255, 0, 0.05)'
                }}>
                  {uploadStatus.details.successful.map((item, index) => (
                    <Typography 
                      key={index} 
                      variant="body2" 
                      color="success.main"
                      sx={{ 
                        mb: 1,
                        '&:last-child': { mb: 0 },
                        wordBreak: 'break-word'
                      }}
                    >
                      {item.file}
                    </Typography>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {uploadStatus && (
          <Button onClick={handleUploadComplete} color="primary">
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default UploadPanel; 