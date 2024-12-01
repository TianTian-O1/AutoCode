import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  InsertDriveFileOutlined,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { API_ENDPOINTS, ERROR_MESSAGES } from '../config';
import { getFileContent, getRelevantFiles } from '../services/api';

function SearchPanel({ onFileSelect }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    try {
      const results = await getRelevantFiles(searchTerm);
      setSearchResults(results || []);
    } catch (error) {
      console.error(ERROR_MESSAGES.serverError, error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = async (file) => {
    try {
      const content = await getFileContent(file.path);
      onFileSelect({
        ...file,
        content,
        language: getFileLanguage(file.name),
      });
    } catch (error) {
      console.error(ERROR_MESSAGES.serverError, error);
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

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom>
          Search Files
        </Typography>
        <form onSubmit={handleSearch}>
          <TextField
            fullWidth
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search files..."
            variant="outlined"
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </form>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : (
          <List dense>
            {searchResults.map((file) => (
              <ListItem
                key={file.path}
                button
                onClick={() => handleFileClick(file)}
                secondaryAction={
                  <IconButton edge="end" size="small">
                    <OpenInNewIcon />
                  </IconButton>
                }
              >
                <ListItemIcon>
                  <InsertDriveFileOutlined />
                </ListItemIcon>
                <ListItemText
                  primary={file.name}
                  secondary={file.path}
                  secondaryTypographyProps={{
                    sx: { fontSize: '0.75rem', color: 'text.secondary' }
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}

export default SearchPanel; 