import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  IconButton,
} from '@mui/material';
import {
  Code as CodeIcon,
  Analytics as AnalyticsIcon,
  GitHub as GitHubIcon,
} from '@mui/icons-material';
import * as api from '../services/api';

function Sidebar({ onAnalyze, onGenerate, onFileSelect, isAnalyzing }) {
  const [repositories, setRepositories] = useState([]);
  const [selectedModel, setSelectedModel] = useState('claude');
  const [githubUsername, setGithubUsername] = useState('');

  const handleGitHubSearch = async () => {
    try {
      const repos = await api.listRepositories(githubUsername);
      setRepositories(repos);
    } catch (error) {
      console.error('Failed to load repositories:', error);
    }
  };

  return (
    <Box sx={{ 
      height: '100%', 
      width: '100%', 
      bgcolor: 'background.paper',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" component="div" gutterBottom>
          AI Code Assistant
        </Typography>
        
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Model</InputLabel>
          <Select
            value={selectedModel}
            label="Model"
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            <MenuItem value="claude">Claude</MenuItem>
            <MenuItem value="gpt">GPT</MenuItem>
          </Select>
        </FormControl>

        <Button
          variant="contained"
          startIcon={<AnalyticsIcon />}
          onClick={() => onAnalyze(selectedModel)}
          fullWidth
          sx={{ mb: 2 }}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Code'}
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<CodeIcon />}
          onClick={() => onGenerate(selectedModel)}
          fullWidth
          sx={{ mb: 2 }}
          disabled={isAnalyzing}
        >
          Generate Code
        </Button>
      </Box>
      
      <Divider />

      <Box sx={{ p: 2, flexGrow: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          GitHub Repositories
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <TextField
            size="small"
            placeholder="GitHub username"
            value={githubUsername}
            onChange={(e) => setGithubUsername(e.target.value)}
          />
          <Button
            variant="contained"
            size="small"
            startIcon={<GitHubIcon />}
            onClick={handleGitHubSearch}
          >
            Search
          </Button>
        </Box>
        <List dense>
          {repositories.map((repo) => (
            <ListItemButton key={repo.id}>
              <ListItemText 
                primary={repo.name}
                secondary={repo.description}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>
    </Box>
  );
}

export default Sidebar;
