import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  IconButton,
  Typography,
  Breadcrumbs,
  Link,
  CircularProgress,
} from '@mui/material';
import {
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  ArrowUpward as ArrowUpwardIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import * as api from '../services/api';

function FileBrowser({ onFileSelect, onFileDelete }) {
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadFiles = async (path) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.listFiles(path);
      setFiles(response.files || []);
    } catch (error) {
      console.error('Failed to load files:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles(currentPath);
  }, [currentPath]);

  const handlePathClick = (path) => {
    setCurrentPath(path);
  };

  const handleFileClick = (file) => {
    if (file.type === 'directory') {
      setCurrentPath(file.path);
    } else if (onFileSelect) {
      onFileSelect(file);
    }
  };

  const handleParentClick = () => {
    if (!currentPath) return;
    const parentPath = currentPath.split('/').slice(0, -1).join('/');
    setCurrentPath(parentPath);
  };

  const renderBreadcrumbs = () => {
    const paths = currentPath.split('/').filter(Boolean);
    return (
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => setCurrentPath('')}
          sx={{ cursor: 'pointer' }}
        >
          Root
        </Link>
        {paths.map((name, index) => {
          const path = paths.slice(0, index + 1).join('/');
          return (
            <Link
              key={path}
              component="button"
              variant="body1"
              onClick={() => handlePathClick(path)}
              sx={{ cursor: 'pointer' }}
            >
              {name}
            </Link>
          );
        })}
      </Breadcrumbs>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, color: 'error.main' }}>
        <Typography>Error: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {renderBreadcrumbs()}
      
      <List>
        {currentPath && (
          <ListItem disablePadding>
            <ListItemButton onClick={handleParentClick}>
              <ListItemIcon>
                <ArrowUpwardIcon />
              </ListItemIcon>
              <ListItemText 
                primary=".." 
                secondary="Parent Directory" 
              />
            </ListItemButton>
          </ListItem>
        )}
        
        {files.map((file) => (
          <ListItem
            key={file.path}
            disablePadding
            secondaryAction={
              onFileDelete && (
                <IconButton 
                  edge="end" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileDelete(file);
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              )
            }
          >
            <ListItemButton onClick={() => handleFileClick(file)}>
              <ListItemIcon>
                {file.type === 'directory' ? <FolderIcon /> : <FileIcon />}
              </ListItemIcon>
              <ListItemText
                primary={file.name}
                secondary={
                  file.type === 'directory'
                    ? `${file.itemCount} items`
                    : `${(file.size / 1024).toFixed(1)} KB`
                }
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

export default FileBrowser; 