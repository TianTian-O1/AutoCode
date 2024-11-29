import React, { useState, useRef, useCallback } from 'react';
import { Box, Typography, LinearProgress, Alert, Snackbar } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import * as api from '../services/api';

function FileUpload({ onUploadComplete }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const dirInputRef = useRef(null);

  const handleFileUpload = useCallback(async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        
        await api.uploadFile(formData);
        setProgress((i + 1) * 100 / files.length);
      }

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || '上传失败');
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [onUploadComplete]);

  const handleDirectoryUpload = useCallback(async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        
        // Get relative path from webkitRelativePath
        const path = file.webkitRelativePath.split('/').slice(0, -1).join('/');
        if (path) {
          formData.append('path', path);
        }

        await api.uploadFile(formData);
        setProgress((i + 1) * 100 / files.length);
      }

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || '上传失败');
    } finally {
      setUploading(false);
      setProgress(0);
      if (dirInputRef.current) {
        dirInputRef.current.value = '';
      }
    }
  }, [onUploadComplete]);

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 2 }}>
        <Box
          component="label"
          htmlFor="file-input"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'action.hover'
            }
          }}
        >
          <input
            id="file-input"
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileUpload}
            ref={fileInputRef}
          />
          <CloudUploadIcon sx={{ mr: 1 }} />
          <Typography>点击上传文件</Typography>
        </Box>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Box
          component="label"
          htmlFor="directory-input"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 1,
            p: 2,
            cursor: 'pointer',
            '&:hover': {
              bgcolor: 'action.hover'
            }
          }}
        >
          <input
            id="directory-input"
            type="file"
            webkitdirectory=""
            directory=""
            multiple
            style={{ display: 'none' }}
            onChange={handleDirectoryUpload}
            ref={dirInputRef}
          />
          <CloudUploadIcon sx={{ mr: 1 }} />
          <Typography>点击上传文件夹</Typography>
        </Box>
      </Box>

      {uploading && (
        <Box sx={{ width: '100%' }}>
          <LinearProgress variant="determinate" value={progress} />
          <Typography variant="body2" color="text.secondary" align="center">
            {Math.round(progress)}%
          </Typography>
        </Box>
      )}

      <Snackbar 
        open={!!error} 
        autoHideDuration={6000} 
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default FileUpload; 