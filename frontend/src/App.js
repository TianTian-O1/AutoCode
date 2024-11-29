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
  Collapse,
  Dialog,
  DialogTitle,
  Typography,
} from '@mui/material';
import {
  Menu as MenuIcon,
  FolderOutlined,
  SearchOutlined,
  AppsOutlined,
  CloudUploadOutlined,
  GitHub as GitHubIcon,
  ExpandLess,
  ExpandMore,
  Close as CloseIcon,
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

const DRAWER_WIDTH = 48; // Width of the collapsed sidebar
const PANEL_WIDTH = 240; // Reduced panel width from 300 to 240

function App() {
  const [code, setCode] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Add effect to log state changes
  useEffect(() => {
    console.log('State changed:', {
      selectedMenu,
      filesCount: files.length,
      isLoadingFiles,
      uploadDialogOpen
    });
  }, [selectedMenu, files, isLoadingFiles, uploadDialogOpen]);

  const loadFiles = async () => {
    if (isLoadingFiles) {
      console.log('Already loading files, skipping...');
      return;
    }
    
    setIsLoadingFiles(true);
    try {
      console.log('Loading files...');
      const fileList = await api.listFiles();
      console.log('Files loaded:', fileList);
      if (Array.isArray(fileList)) {
        setFiles(fileList);
      } else {
        console.error('Invalid file list format:', fileList);
        setFiles([]);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
      setFiles([]);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleMenuSelect = (menuId) => {
    console.log('Menu selected:', menuId, 'Previous:', selectedMenu);
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

  const handleAnalyzeCode = async (model) => {
    if (!code.trim()) return;
    
    setIsAnalyzing(true);
    try {
      const response = await api.analyzeCode(code, model);
      const analysis = response.choices?.[0]?.message?.content;
      if (analysis) {
        // Handle the analysis result
        console.log('Code analysis:', analysis);
      }
    } catch (error) {
      console.error('Failed to analyze code:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateCode = async (model) => {
    try {
      const response = await api.generateCode('Write a simple hello world program', model);
      const generatedCode = response.choices?.[0]?.message?.content;
      if (generatedCode) {
        // Extract code from markdown if present
        const codeMatch = generatedCode.match(/```(?:[\w]*\n)?([\s\S]*?)```/);
        if (codeMatch) {
          setCode(codeMatch[1].trim());
        } else {
          setCode(generatedCode);
        }
      }
    } catch (error) {
      console.error('Failed to generate code:', error);
    }
  };

  const handleFileSelect = useCallback((file) => {
    // Check if file is already open
    const existingFile = openFiles.find(f => f.path === file.path);
    if (existingFile) {
      setActiveFile(existingFile);
      setCode(existingFile.content);
    } else {
      // Add new file to openFiles
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
    console.log('Upload successful, loading files and showing Files panel');
    // First set the menu to files to ensure the panel is visible
    setSelectedMenu('files');
    // Then load the files with a small delay to ensure the panel is mounted
    setTimeout(() => {
      loadFiles();
    }, 100);
    setUploadDialogOpen(false);
  }, []);

  const handleCloseUploadDialog = useCallback(() => {
    setUploadDialogOpen(false);
  }, []);

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
    console.log('Rendering panel:', {
      selectedMenu,
      hasFiles: files.length > 0,
      isLoadingFiles
    });

    const menuItem = menuItems.find(item => item.id === selectedMenu);
    if (!menuItem) {
      console.log('No menu item found');
      return null;
    }

    const Panel = menuItem.panel;
    if (!Panel) {
      console.log('No panel component for menu item:', menuItem.id);
      return (
        <Box sx={{ p: 2 }}>
          <Typography variant="body1">{menuItem.text}</Typography>
        </Box>
      );
    }

    if (menuItem.id === 'files') {
      console.log('Rendering FilePanel with files:', files);
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
        data-testid={`${menuItem.id}-panel`}
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
          onAnalyze={handleAnalyzeCode}
          onGenerate={handleGenerateCode}
          isAnalyzing={isAnalyzing}
        />

        {/* Upload Dialog */}
        {uploadDialogOpen && (
          <UploadPanel
            onUploadSuccess={handleUploadSuccess}
            onClose={handleCloseUploadDialog}
          />
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App;
