import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Code as CodeIcon,
  Terminal as TerminalIcon,
  Storage as DatabaseIcon,
  Cloud as CloudIcon,
  Settings as SettingsIcon,
  PlayArrow as RunIcon,
} from '@mui/icons-material';

const apps = [
  {
    id: 'code-generator',
    name: 'Code Generator',
    description: 'Generate code using AI',
    icon: <CodeIcon />,
  },
  {
    id: 'terminal',
    name: 'Terminal',
    description: 'Integrated terminal',
    icon: <TerminalIcon />,
  },
  {
    id: 'database',
    name: 'Database',
    description: 'Database management',
    icon: <DatabaseIcon />,
  },
  {
    id: 'cloud',
    name: 'Cloud Deploy',
    description: 'Deploy to cloud',
    icon: <CloudIcon />,
  },
  {
    id: 'settings',
    name: 'Settings',
    description: 'App settings',
    icon: <SettingsIcon />,
  },
];

function AppsPanel({ onAppSelect }) {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" gutterBottom>
          Apps
        </Typography>
      </Box>

      <List sx={{ flexGrow: 1, overflow: 'auto' }}>
        {apps.map((app) => (
          <ListItem
            key={app.id}
            button
            onClick={() => onAppSelect(app.id)}
            secondaryAction={
              <Tooltip title="Run">
                <IconButton edge="end" size="small">
                  <RunIcon />
                </IconButton>
              </Tooltip>
            }
          >
            <ListItemIcon>{app.icon}</ListItemIcon>
            <ListItemText
              primary={app.name}
              secondary={app.description}
              secondaryTypographyProps={{
                sx: { fontSize: '0.75rem', color: 'text.secondary' }
              }}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

export default AppsPanel; 