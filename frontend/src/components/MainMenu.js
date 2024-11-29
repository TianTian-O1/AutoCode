import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import SearchIcon from '@mui/icons-material/Search';
import AppsIcon from '@mui/icons-material/Apps';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

function MainMenu({ selectedMenu, onMenuSelect }) {
  const menuItems = [
    { id: 'files', icon: FolderIcon, tooltip: '文件' },
    { id: 'search', icon: SearchIcon, tooltip: '搜索' },
    { id: 'apps', icon: AppsIcon, tooltip: '应用' },
    { id: 'upload', icon: CloudUploadIcon, tooltip: '文件上传' },
  ];

  return (
    <Box sx={{ 
      width: 48, 
      bgcolor: 'background.paper',
      borderRight: 1,
      borderColor: 'divider',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      py: 1,
      gap: 1
    }}>
      {menuItems.map(({ id, icon: Icon, tooltip }) => (
        <Tooltip key={id} title={tooltip} placement="right">
          <IconButton
            color={selectedMenu === id ? 'primary' : 'default'}
            onClick={() => onMenuSelect(id)}
          >
            <Icon />
          </IconButton>
        </Tooltip>
      ))}
    </Box>
  );
}

export default MainMenu; 