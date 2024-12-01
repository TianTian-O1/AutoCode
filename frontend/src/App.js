import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  CssBaseline,
  ThemeProvider,
  createTheme,
  IconButton,
  Drawer,
  List,
  ListItem,
  Tooltip,
  ButtonGroup,
} from '@mui/material';
import {
  Menu as MenuIcon,
  FolderOutlined,
  SearchOutlined,
  AppsOutlined,
  CloudUploadOutlined,
  GitHub as GitHubIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material';
import Editor from './components/Editor';
import ChatPanel from './components/ChatPanel';
import FilePanel from './components/FilePanel';
import SearchPanel from './components/SearchPanel';
import AppsPanel from './components/AppsPanel';
import UploadPanel from './components/UploadPanel';
import * as api from './services/api';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const DRAWER_WIDTH = 48;
const PANEL_WIDTH = 240;

function App() {
  const [code, setCode] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  const loadFiles = async () => {
    if (isLoadingFiles) return;
    setIsLoadingFiles(true);
    try {
      const fileList = await api.listFiles();
      if (Array.isArray(fileList)) {
        setFiles(fileList);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
      setFiles([]);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleMenuSelect = (menuId) => {
    const isClosing = selectedMenu === menuId;
    if (menuId === 'files' && !isClosing) {
      loadFiles();
    }
    setSelectedMenu(isClosing ? null : menuId);
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (activeFile) {
      setOpenFiles(prev => prev.map(file => 
        file.path === activeFile.path ? { ...file, content: newCode } : file
      ));
    }
  };

  const handleFileSelect = useCallback((file) => {
    const existingFile = openFiles.find(f => f.path === file.path);
    if (existingFile) {
      setActiveFile(existingFile);
      setCode(existingFile.content);
    } else {
      const newFile = { ...file, id: Date.now() };
      setOpenFiles(prev => [...prev, newFile]);
      setActiveFile(newFile);
      setCode(file.content || '');
    }
  }, [openFiles]);

  const handleFileClose = useCallback((file) => {
    setOpenFiles(prev => prev.filter(f => f.path !== file.path));
    if (activeFile && activeFile.path === file.path) {
      const remainingFiles = openFiles.filter(f => f.path !== file.path);
      if (remainingFiles.length > 0) {
        setActiveFile(remainingFiles[remainingFiles.length - 1]);
        setCode(remainingFiles[remainingFiles.length - 1].content || '');
      } else {
        setActiveFile(null);
        setCode('');
      }
    }
  }, [activeFile, openFiles]);

  const handleUploadSuccess = useCallback(() => {
    setSelectedMenu('files');
    setTimeout(loadFiles, 100);
    setUploadDialogOpen(false);
  }, []);

  const handleUndo = async () => {
    try {
      await fetch('/api/undo', { method: 'POST' });
      loadFiles(); // 刷新文件列表
    } catch (error) {
      console.error('Error undoing:', error);
    }
  };

  const handleRedo = async () => {
    try {
      await fetch('/api/redo', { method: 'POST' });
      loadFiles(); // 刷新文件列表
    } catch (error) {
      console.error('Error redoing:', error);
    }
  };

  const handleReset = async () => {
    try {
      await fetch('/api/reset', { method: 'POST' });
      loadFiles(); // 刷新文件列表
    } catch (error) {
      console.error('Error resetting:', error);
    }
  };

  const menuItems = [
    { id: 'files', icon: <FolderOutlined />, text: 'Files', panel: FilePanel },
    { id: 'search', icon: <SearchOutlined />, text: 'Search', panel: SearchPanel },
    { id: 'apps', icon: <AppsOutlined />, text: 'Apps', panel: AppsPanel },
    { 
      id: 'upload', 
      icon: <CloudUploadOutlined />, 
      text: 'Upload',
      onClick: () => setUploadDialogOpen(true)
    },
    { id: 'github', icon: <GitHubIcon />, text: 'GitHub' },
  ];

  const renderPanel = () => {
    const menuItem = menuItems.find(item => item.id === selectedMenu);
    if (!menuItem?.panel) return null;

    const Panel = menuItem.panel;
    if (menuItem.id === 'files') {
      return (
        <Panel
          files={files}
          onFileSelect={handleFileSelect}
          onUploadClick={() => setUploadDialogOpen(true)}
          onFileChange={loadFiles}
        />
      );
    }
    
    return (
      <Panel
        onFileSelect={handleFileSelect}
        onFileClose={handleFileClose}
        openFiles={openFiles}
        activeFile={activeFile}
      />
    );
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', display: 'flex', overflow: 'hidden' }}>
        {/* Left Sidebar */}
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              backgroundColor: 'background.paper',
              borderRight: 1,
              borderColor: 'divider',
            },
          }}
        >
          <List sx={{ p: 1 }}>
            {/* 回退按钮组 */}
            <ListItem disablePadding sx={{ mb: 1 }}>
              <ButtonGroup
                size="small"
                orientation="vertical"
                variant="outlined"
                sx={{ width: '100%' }}
              >
                <Tooltip title="撤销" placement="right">
                  <IconButton onClick={handleUndo}>
                    <UndoIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="重做" placement="right">
                  <IconButton onClick={handleRedo}>
                    <RedoIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="重置" placement="right">
                  <IconButton onClick={handleReset}>
                    <ResetIcon />
                  </IconButton>
                </Tooltip>
              </ButtonGroup>
            </ListItem>

            {/* 原有菜单项 */}
            {menuItems.map((item) => (
              <ListItem 
                key={item.id} 
                disablePadding 
                sx={{ mb: 1 }}
              >
                <Tooltip title={item.text} placement="right">
                  <IconButton
                    onClick={item.onClick || (() => handleMenuSelect(item.id))}
                    color={selectedMenu === item.id ? 'primary' : 'default'}
                    sx={{ 
                      width: '100%',
                      height: 40,
                      borderRadius: 1,
                    }}
                  >
                    {item.icon}
                  </IconButton>
                </Tooltip>
              </ListItem>
            ))}
          </List>
        </Drawer>

        {/* Side Panel */}
        <Box 
          sx={{
            width: selectedMenu ? PANEL_WIDTH : 0,
            transition: 'width 0.2s',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <Box sx={{ 
            width: PANEL_WIDTH,
            height: '100%',
            borderRight: 1,
            borderColor: 'divider',
            backgroundColor: 'background.paper',
          }}>
            {selectedMenu && renderPanel()}
          </Box>
        </Box>

        {/* Main Editor Area */}
        <Box sx={{ 
          flexGrow: 1,
          height: '100%',
          mr: '400px', // Leave space for chat panel
        }}>
          <Editor
            value={code}
            onChange={handleCodeChange}
            language={activeFile?.language || 'plaintext'}
            path={activeFile?.path}
          />
        </Box>

        {/* Right Chat Panel */}
        <ChatPanel
          onSendCode={setCode}
          onAnalyze={() => setIsAnalyzing(true)}
          onGenerate={() => {}}
          isAnalyzing={isAnalyzing}
        />

        {/* Upload Dialog */}
        {uploadDialogOpen && (
          <UploadPanel
            onUploadSuccess={handleUploadSuccess}
            onClose={() => setUploadDialogOpen(false)}
          />
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App;
