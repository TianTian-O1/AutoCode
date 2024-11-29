import React, { useState, useEffect } from 'react';
import { 
  Box, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  useTheme,
  CircularProgress
} from '@mui/material';
import {
  InsertDriveFile as FileIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  MoreVert as MoreIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  Code as CodeIcon,
  Api as JavaScriptIcon,
  Terminal as PythonIcon,
  DataObject as JsonIcon,
  Article as MarkdownIcon,
  Html as HtmlIcon,
  Css as CssIcon,
  Terminal as ShellIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import { deletePath } from '../services/api';
import * as api from '../services/api';

const getFileIcon = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  const iconMap = {
    // Programming Languages
    'js': JavaScriptIcon,
    'jsx': JavaScriptIcon,
    'ts': JavaScriptIcon,
    'tsx': JavaScriptIcon,
    'py': PythonIcon,
    'cpp': CodeIcon,
    'c': CodeIcon,
    'h': CodeIcon,
    'hpp': CodeIcon,
    'java': CodeIcon,
    'go': CodeIcon,
    'rs': CodeIcon,
    // Web
    'html': HtmlIcon,
    'css': CssIcon,
    'scss': CssIcon,
    'sass': CssIcon,
    // Data
    'json': JsonIcon,
    'yaml': JsonIcon,
    'yml': JsonIcon,
    // Documentation
    'md': MarkdownIcon,
    'txt': MarkdownIcon,
    // Shell
    'sh': ShellIcon,
    'bash': ShellIcon,
    'zsh': ShellIcon,
    // Images
    'png': ImageIcon,
    'jpg': ImageIcon,
    'jpeg': ImageIcon,
    'gif': ImageIcon,
    'svg': ImageIcon,
  };
  
  return iconMap[ext] || FileIcon;
};

const FilePanel = ({ files = [], onFileSelect, onUploadClick, onFileChange }) => {
  const theme = useTheme();
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [rootFiles, setRootFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    console.log('FilePanel: files updated', files);
    setIsProcessing(true);
    // Process files in the next tick to avoid blocking the UI
    setTimeout(() => {
      const rootLevel = files.filter(f => !f.path.includes('/'));
      rootLevel.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === 'directory' ? -1 : 1;
      });
      setRootFiles(rootLevel);
      setIsProcessing(false);
    }, 0);
  }, [files]);

  const handleContextMenu = (event, file) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
    });
    setSelectedFile(file);
  };

  const handleClose = () => {
    setContextMenu(null);
    setSelectedFile(null);
  };

  const handleDelete = async () => {
    if (!selectedFile) return;

    try {
      await deletePath(selectedFile.path);
      onFileChange();
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
    setDeleteConfirmOpen(false);
    handleClose();
  };

  const handleDeleteClick = () => {
    setDeleteConfirmOpen(true);
    setContextMenu(null);
  };

  const handleFileClick = async (file) => {
    if (file.type === 'directory') {
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        if (newSet.has(file.path)) {
          newSet.delete(file.path);
        } else {
          newSet.add(file.path);
        }
        return newSet;
      });
    } else {
      try {
        console.log('Reading file:', file.path);
        const response = await api.readFile(file.path);
        const language = getFileLanguage(file.name);
        console.log('File read response:', response);
        
        if (!response || !response.content) {
          throw new Error('Invalid file content received');
        }
        
        onFileSelect({
          ...file,
          content: response.content,
          language
        });
      } catch (error) {
        console.error('Failed to read file:', error);
      }
    }
  };

  const getFileLanguage = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const languageMap = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
    };
    return languageMap[ext] || 'plaintext';
  };

  const renderFileList = () => {
    const renderFileItem = (file, level = 0) => {
      const isDirectory = file.type === 'directory';
      const isExpanded = expandedFolders.has(file.path);
      const childFiles = isDirectory ? files.filter(f => {
        const parentPath = file.path + '/';
        return f.path.startsWith(parentPath) && f.path.slice(parentPath.length).split('/').length === 1;
      }) : [];

      return (
        <React.Fragment key={file.path}>
          <ListItem
            button
            onClick={() => handleFileClick(file)}
            onContextMenu={(e) => handleContextMenu(e, file)}
            sx={{
              pl: 1 + level * 2,
              py: 0.5,
              '&:hover': {
                bgcolor: 'action.hover',
                '& .actions': {
                  opacity: 1,
                }
              }
            }}
          >
            <ListItemIcon 
              sx={{ 
                minWidth: 32,
                width: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDirectory ? theme.palette.primary.main : 'inherit'
              }}
            >
              {isDirectory ? (
                isExpanded ? <FolderOpenIcon sx={{ fontSize: 20 }} /> : <FolderIcon sx={{ fontSize: 20 }} />
              ) : (
                React.createElement(getFileIcon(file.name), { sx: { fontSize: 20 } })
              )}
            </ListItemIcon>
            <ListItemText
              primary={file.name}
              secondary={isDirectory ? `${childFiles.length} items` : `${(file.size / 1024).toFixed(1)} KB`}
              primaryTypographyProps={{
                variant: 'body2',
                sx: {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }
              }}
              secondaryTypographyProps={{
                sx: { fontSize: '0.75rem' }
              }}
            />
            <IconButton
              className="actions"
              edge="end"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleContextMenu(e, file);
              }}
              sx={{
                opacity: 0,
                transition: 'opacity 0.2s',
                padding: 0.5,
                margin: '0 4px'
              }}
            >
              <MoreIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </ListItem>
          {isDirectory && isExpanded && childFiles.map(childFile => renderFileItem(childFile, level + 1))}
        </React.Fragment>
      );
    };

    return rootFiles.map(file => renderFileItem(file, 0));
  };

  return (
    <Box 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Box 
        sx={{ 
          p: 0.5, 
          borderBottom: 1, 
          borderColor: 'divider',
          flexShrink: 0
        }}
      >
        <Button
          fullWidth
          variant="contained"
          size="small"
          startIcon={<UploadIcon />}
          onClick={onUploadClick}
        >
          Upload
        </Button>
      </Box>

      {isProcessing ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}>
          <CircularProgress size={24} />
        </Box>
      ) : rootFiles.length === 0 ? (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No files found. Click the Upload button to add files.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          <List component="div" disablePadding>
            {renderFileList()}
          </List>
        </Box>
      )}

      <Menu
        open={contextMenu !== null}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleDeleteClick} dense>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        sx={{ zIndex: 1301 }}
      >
        <DialogTitle>Delete File</DialogTitle>
        <DialogContent>
          <Typography>
            Delete "{selectedFile?.name}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FilePanel; 