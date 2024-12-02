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
  CircularProgress,
  Typography,
} from '@mui/material';
import {
  FolderOutlined,
  SearchOutlined,
  AppsOutlined,
  CloudUploadOutlined,
  GitHub as GitHubIcon,
  RestartAlt as ResetIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import Editor from './components/Editor';
import FilePanel from './components/FilePanel';
import SearchPanel from './components/SearchPanel';
import ChatPanel from './components/ChatPanel';
import AppsPanel from './components/AppsPanel';
import UploadPanel from './components/UploadPanel';
import { listFiles, uploadFile, resetProject, getFileContent } from './services/api';
import { ERROR_MESSAGES } from './config';

const theme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const DRAWER_WIDTH = 48;
const PANEL_WIDTH = 240;

function App() {
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [files, setFiles] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [code, setCode] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [fileContentCache, setFileContentCache] = useState({});
  const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);
  const [editorOptions, setEditorOptions] = useState({
    fontSize: 14,
    tabSize: 2,
    minimap: { enabled: true },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    lineNumbers: 'on',
    wordWrap: 'on',
  });

  const loadFiles = async () => {
    if (isLoadingFiles) return;
    setIsLoadingFiles(true);
    try {
      const fileList = await listFiles();
      if (Array.isArray(fileList)) {
        setFiles(fileList);
      }
    } catch (error) {
      console.error(ERROR_MESSAGES.serverError, error);
      setFiles([]);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

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

  const handleFileSelect = useCallback(async (file) => {
    if (!file || !file.path) {
      console.error('Invalid file object:', file);
      return;
    }

    const existingFile = openFiles.find(f => f.path === file.path);
    if (existingFile) {
      setActiveFile(existingFile);
      setCode(existingFile.content);
    } else {
      try {
        setIsLoadingFileContent(true);
        let content = fileContentCache[file.path];
        if (!content) {
          console.log('Loading file content for:', file.path);
          content = await getFileContent(file.path);
          console.log('Loaded content:', content ? content.substring(0, 100) + '...' : 'null');
          if (!content) {
            throw new Error('Failed to load file content');
          }
          setFileContentCache(prev => ({
            ...prev,
            [file.path]: content
          }));
        }
        const newFile = { 
          ...file, 
          id: Date.now(),
          content: content
        };
        console.log('Creating new file object:', newFile);
        setOpenFiles(prev => [...prev, newFile]);
        setActiveFile(newFile);
        setCode(content);
      } catch (error) {
        console.error('Error loading file content:', error);
      } finally {
        setIsLoadingFileContent(false);
      }
    }
  }, [openFiles, fileContentCache]);

  const handleFileClose = useCallback((file) => {
    setOpenFiles(prev => prev.filter(f => f.path !== file.path));
    if (activeFile && activeFile.path === file.path) {
      const remainingFiles = openFiles.filter(f => f.path !== file.path);
      if (remainingFiles.length > 0) {
        const lastFile = remainingFiles[remainingFiles.length - 1];
        setActiveFile(lastFile);
        setCode(lastFile.content || '');
      } else {
        setActiveFile(null);
        setCode('');
      }
    }
  }, [activeFile, openFiles]);

  const handleUploadSuccess = useCallback(() => {
    loadFiles();
    setUploadDialogOpen(false);
  }, []);

  const handleAnalyze = async () => {
    if (!activeFile) return;
    setIsAnalyzing(true);
    try {
      // 实现代码分析功能
      console.log('Analyzing code:', activeFile.path);
    } catch (error) {
      console.error(ERROR_MESSAGES.analyzeError, error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    try {
      // 实现代码生成功能
      console.log('Generating code');
    } catch (error) {
      console.error(ERROR_MESSAGES.generateError, error);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('确定要清空项目吗？此操作不可恢复。')) {
      return;
    }

    try {
      setIsLoadingFiles(true);
      await resetProject();
      setActiveFile(null);
      setOpenFiles([]);
      setCode('');
      await loadFiles();
    } catch (error) {
      console.error(ERROR_MESSAGES.serverError, error);
    } finally {
      setIsLoadingFiles(false);
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
    { 
      id: 'reset', 
      icon: <ResetIcon />, 
      text: 'Reset Project',
      onClick: handleReset
    },
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
    <ThemeProvider theme={theme}>
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

        {/* Left Panel */}
        {selectedMenu && (
          <Box
            sx={{
              width: PANEL_WIDTH,
              flexShrink: 0,
              backgroundColor: 'background.paper',
              borderRight: 1,
              borderColor: 'divider',
              overflow: 'hidden',
            }}
          >
            {renderPanel()}
          </Box>
        )}

        {/* Main Editor Area */}
        <Box sx={{ 
          flexGrow: 1, 
          height: '100%',
          mr: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          bgcolor: 'background.default',
          overflow: 'hidden',
        }}>
          {/* Editor Container */}
          <Box sx={{ 
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
            borderLeft: 1,
            borderRight: 1,
            borderColor: 'divider',
          }}>
            {/* Editor Tabs */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              p: 1, 
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              minHeight: 48,
            }}>
              <ButtonGroup size="small" sx={{ mr: 1 }}>
                {openFiles.map(file => (
                  <Tooltip key={file.path} title={file.path}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <IconButton
                        size="small"
                        onClick={() => handleFileSelect(file)}
                        color={activeFile?.path === file.path ? 'primary' : 'default'}
                        sx={{ 
                          fontSize: '0.75rem',
                          px: 1,
                          borderRadius: '4px 0 0 4px'
                        }}
                      >
                        {file.name}
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFileClose(file);
                        }}
                        sx={{ 
                          fontSize: '0.75rem',
                          p: 0.5,
                          minWidth: 'auto',
                          borderRadius: '0 4px 4px 0',
                          '&:hover': {
                            color: 'error.main'
                          }
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Tooltip>
                ))}
              </ButtonGroup>
              {isAnalyzing && <CircularProgress size={20} sx={{ ml: 1 }} />}
            </Box>

            {/* Editor */}
            <Box sx={{ flexGrow: 1, position: 'relative' }}>
              <Editor
                value={code}
                onChange={setCode}
                language={activeFile?.language || 'plaintext'}
                path={activeFile?.path}
              />
              {isLoadingFileContent && (
                <Box sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  p: 1,
                  bgcolor: 'background.paper',
                  borderBottom: 1,
                  borderColor: 'divider',
                }}>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  <Typography variant="body2">Loading file content...</Typography>
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {/* Right Chat Panel */}
        <Box
          sx={{
            position: 'fixed',
            right: 0,
            top: 0,
            width: '400px',
            height: '100vh',
            borderLeft: 1,
            borderColor: 'divider',
            backgroundColor: 'background.paper',
          }}
        >
          <ChatPanel
            onSendCode={setCode}
            onAnalyze={handleAnalyze}
            onGenerate={handleGenerate}
            isAnalyzing={isAnalyzing}
            activeFile={activeFile}
            handleFileSelect={handleFileSelect}
          />
        </Box>

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

