import React, { useState } from 'react';
import { 
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

function FileTree({ files, onFileSelect, projectName }) {
  const [expandedFolders, setExpandedFolders] = useState(new Set());

  const handleFolderClick = (event, folderPath) => {
    event.stopPropagation();
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath);
      } else {
        newSet.add(folderPath);
      }
      return newSet;
    });
  };

  const renderFileList = (items, level = 0) => {
    if (!items) return null;

    return items.map(item => {
      const isFolder = item.type === 'folder';
      const depth = item.path.split('/').length - 1;
      const parentPath = item.path.split('/').slice(0, -1).join('/');
      const shouldShow = depth === 0 || expandedFolders.has(parentPath);

      if (!shouldShow) return null;

      return (
        <Box key={item.path}>
          <ListItemButton
            onClick={(e) => isFolder ? handleFolderClick(e, item.path) : onFileSelect(e, projectName, item)}
            sx={{ 
              pl: 4 + depth * 2,
              py: 0.5,
              minHeight: 36,
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
              }
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              {isFolder ? <FolderIcon /> : <InsertDriveFileIcon />}
            </ListItemIcon>
            <ListItemText 
              primary={item.name}
              sx={{ 
                m: 0,
                '.MuiListItemText-primary': { 
                  fontSize: '0.9rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }
              }}
            />
            {isFolder && (
              <Box sx={{ ml: 1 }}>
                {expandedFolders.has(item.path) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>
            )}
          </ListItemButton>
        </Box>
      );
    });
  };

  return (
    <List 
      component="div" 
      disablePadding 
      sx={{ 
        width: '100%',
        overflow: 'auto'
      }}
    >
      {renderFileList(files)}
    </List>
  );
}

export default FileTree; 