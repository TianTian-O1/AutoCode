import React, { useState, useEffect } from 'react';
import { 
  Box, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText,
  Typography,
  useTheme,
  CircularProgress,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from '@mui/material';
import {
  InsertDriveFile as FileIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Delete as DeleteIcon,
  CloudUpload as UploadIcon,
  MoreVert as MoreIcon,
  Code as CodeIcon,
  Api as JavaScriptIcon,
  Terminal as PythonIcon,
  DataObject as JsonIcon,
  Article as MarkdownIcon,
  Html as HtmlIcon,
  Css as CssIcon,
  Terminal as ShellIcon,
  Image as ImageIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Close as CloseIcon,
  Refresh as RefreshIcon,
  DeleteForever as DeleteForeverIcon,
  DeleteSweep as DeleteSweepIcon,
} from '@mui/icons-material';
import { API_ENDPOINTS, ERROR_MESSAGES } from '../config';
import { deletePath, getFileContent } from '../services/api';

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
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [rootFiles, setRootFiles] = useState([]);
  const [filesByPath, setFilesByPath] = useState({});
  const [isProcessing, setIsProcessing] = useState(true);
  const [openFiles, setOpenFiles] = useState(new Set());
  const [deleteProjectConfirmOpen, setDeleteProjectConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    const processFiles = () => {
      setIsProcessing(true);
      console.log('Raw files:', files);  // 打印原始文件列表
      
      // Process files in the next tick to avoid blocking the UI
      setTimeout(() => {
        // 首先按路径对文件进行分组
        const filesByPath = {};
        files.forEach(file => {
          if (!file || !file.path) {
            console.log('Invalid file:', file);  // 打印无效的文件
            return;
          }
          
          console.log('Processing file:', file.path);  // 打印正在处理的文件路径
          
          const parts = file.path.split('/');
          console.log('Path parts:', parts);  // 打印路径分割结果
          
          let currentPath = '';
          
          // 创建目录结构
          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            const parentPath = currentPath;
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            
            console.log('Creating directory:', {  // 打印目录创建信息
              part,
              currentPath,
              parentPath
            });
            
            if (!filesByPath[currentPath]) {
              filesByPath[currentPath] = {
                name: part,
                path: currentPath,
                type: 'directory',
                parent: parentPath || null
              };
            }
          }
          
          // 添加文件
          filesByPath[file.path] = {
            ...file,
            parent: currentPath || null
          };
        });

        // 获取根级别的文件和目录
        const rootLevel = Object.values(filesByPath).filter(f => !f.parent);
        
        // 排序：目录在前，文件在后，同类型按名称排序
        rootLevel.sort((a, b) => {
          if (a.type === b.type) {
            return a.name.localeCompare(b.name);
          }
          return a.type === 'directory' ? -1 : 1;
        });

        console.log('Processed data:', {  // 打印处理后的数据
          filesByPath,
          rootLevel,
          fileCount: Object.keys(filesByPath).length,
          rootCount: rootLevel.length
        });
        
        setFilesByPath(filesByPath);
        setRootFiles(rootLevel);
        setIsProcessing(false);
      }, 0);
    };

    processFiles();
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

  const handleDeleteClick = () => {
    setDeleteConfirmOpen(true);
    setContextMenu(null);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedFile) return;

    try {
      await deletePath(selectedFile.path);
      onFileChange();
    } catch (error) {
      console.error(ERROR_MESSAGES.serverError, error);
    }
    setDeleteConfirmOpen(false);
    handleClose();
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
      return;
    }

    try {
      console.log('Reading file:', file.path);
      const content = await getFileContent(file.path);
      const language = getFileLanguage(file.name);
      console.log('File content received');
      
      if (!content) {
        throw new Error(ERROR_MESSAGES.serverError);
      }
      
      setOpenFiles(prev => new Set(prev).add(file.path));
      onFileSelect({
        ...file,
        content,
        language
      });
    } catch (error) {
      console.error(ERROR_MESSAGES.serverError, error);
    }
  };

  const handleCloseFile = (e, filePath) => {
    e.stopPropagation();
    setOpenFiles(prev => {
      const newSet = new Set(prev);
      newSet.delete(filePath);
      return newSet;
    });
    const nextOpenFile = Array.from(openFiles).find(path => path !== filePath);
    if (nextOpenFile) {
      const file = files.find(f => f.path === nextOpenFile);
      if (file) {
        onFileSelect(file);
      }
    } else {
      onFileSelect({ path: '', content: '', language: 'plaintext' });
    }
  };

  const handleResetProject = () => {
    setExpandedFolders(new Set());
    setOpenFiles(new Set());
    setRootFiles([]);
    onFileSelect({ path: '', content: '', language: 'plaintext' });
    onFileChange();
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

  const handleDeleteProject = async (projectPath) => {
    setProjectToDelete(projectPath);
    setDeleteProjectConfirmOpen(true);
  };

  const handleDeleteProjectConfirm = async () => {
    if (!projectToDelete) return;

    try {
      // 删除项目文件夹
      await deletePath(projectToDelete);
      
      // 关闭相关的文件
      setOpenFiles(prev => {
        const newSet = new Set();
        prev.forEach(path => {
          if (!path.startsWith(projectToDelete + '/')) {
            newSet.add(path);
          }
        });
        return newSet;
      });

      // 如果没有打开的文件，显示空编辑器
      if (openFiles.size === 0) {
        onFileSelect({ path: '', content: '', language: 'plaintext' });
      }

      onFileChange();
    } catch (error) {
      console.error(ERROR_MESSAGES.serverError, error);
    }
    setDeleteProjectConfirmOpen(false);
    setProjectToDelete(null);
  };

  const handleClearAll = async () => {
    setClearConfirmOpen(true);
  };

  const handleClearConfirm = async () => {
    try {
      setClearConfirmOpen(false);
      // Reset state immediately to clear the UI
      setExpandedFolders(new Set());
      setOpenFiles(new Set());
      setRootFiles([]);
      onFileSelect({ path: '', content: '', language: 'plaintext' });
      
      // Delete files in the background
      for (const file of files) {
        await deletePath(file.path);
      }
      
      // Refresh file list
      onFileChange();
    } catch (error) {
      console.error(ERROR_MESSAGES.serverError, error);
    }
  };

  const renderFileList = () => {
    console.log('Rendering file list:', {  // 打印渲染信息
      rootFiles,
      filesByPath,
      expandedFolders: Array.from(expandedFolders)
    });
    
    const renderFileItem = (file, level = 0) => {
      console.log('Rendering item:', {  // 打印每个项目的渲染信息
        file,
        level,
        isDirectory: file.type === 'directory',
        isExpanded: expandedFolders.has(file.path)
      });
      
      const isDirectory = file.type === 'directory';
      const isExpanded = expandedFolders.has(file.path);
      const isOpen = openFiles.has(file.path);
      
      // 获取子文件和目录
      const children = Object.values(filesByPath).filter(f => f.parent === file.path);
      console.log('Children for', file.path, ':', children);  // 打印子项信息
      
      children.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name);
        }
        return a.type === 'directory' ? -1 : 1;
      });

      return (
        <React.Fragment key={file.path}>
          <ListItem
            button
            onClick={() => handleFileClick(file)}
            onContextMenu={(e) => handleContextMenu(e, file)}
            sx={{
              pl: 1 + level * 2,
              py: 0.5,
              bgcolor: isOpen ? 'action.selected' : 'inherit',
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
              secondary={isDirectory ? `${children.length} items` : `${(file.size / 1024).toFixed(1)} KB`}
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
            {isDirectory && (
              isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />
            )}
            {isOpen && (
              <IconButton
                size="small"
                onClick={(e) => handleCloseFile(e, file.path)}
                sx={{ ml: 1 }}
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
            {!isDirectory && (
              <IconButton
                className="actions"
                edge="end"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteClick();
                  setSelectedFile(file);
                }}
                sx={{
                  opacity: 0,
                  transition: 'opacity 0.2s',
                  padding: 0.5,
                  margin: '0 4px',
                  color: 'error.main',
                }}
              >
                <DeleteForeverIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </ListItem>
          {isDirectory && isExpanded && children.map(child => renderFileItem(child, level + 1))}
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
          flexShrink: 0,
          display: 'flex',
          gap: 1
        }}
      >
        <Button
          variant="contained"
          size="small"
          startIcon={<UploadIcon />}
          onClick={onUploadClick}
          sx={{ flex: 1 }}
        >
          Upload
        </Button>
        <Tooltip title="Reset View">
          <IconButton
            size="small"
            onClick={handleResetProject}
            sx={{ 
              bgcolor: 'background.paper',
              '&:hover': { bgcolor: 'action.hover' }
            }}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Clear All Files">
          <IconButton
            size="small"
            onClick={handleClearAll}
            sx={{ 
              bgcolor: 'background.paper',
              color: 'error.main',
              '&:hover': { bgcolor: 'error.light', color: 'white' }
            }}
          >
            <DeleteSweepIcon />
          </IconButton>
        </Tooltip>
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
        onClose={handleClose}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selectedFile?.name}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error">Delete</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteProjectConfirmOpen}
        onClose={() => setDeleteProjectConfirmOpen(false)}
      >
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the entire project "{projectToDelete}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteProjectConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteProjectConfirm} color="error">Delete Project</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
      >
        <DialogTitle>Clear All Files</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete all files? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleClearConfirm} color="error">Clear All</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FilePanel; 