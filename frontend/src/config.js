// API Configuration
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
export const CURSOR_API_URL = process.env.REACT_APP_CURSOR_API_URL || 'http://localhost:3001';
export const CURSOR_API_KEY = process.env.REACT_APP_CURSOR_API_KEY;

// Upload Configuration
export const UPLOAD_CONFIG = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  timeout: 300000, // 5 minutes
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
};

// API Endpoints
export const API_ENDPOINTS = {
  upload: '/api/upload',
  files: '/api/files',
  fileContent: '/api/files/content',
  reset: '/api/reset',
  chat: '/v1/chat/completions',
  models: '/v1/models',
  analyze: '/api/analyze-code'
};

// Cursor API Configuration
export const CURSOR_CONFIG = {
  defaultModel: 'gpt-4o',
  models: ['gpt-4o', 'claude-3-5-sonnet-20241022', 'gpt-4o-mini', 'o1-mini', 'o1-preview', 'cursor-small'],
  timeout: 60000,
  retryAttempts: 2,
  retryDelay: 1000,
  debug: true // 启用调试模式
};

// Error Messages
export const ERROR_MESSAGES = {
  networkError: 'Network error: Cannot connect to server. Please check if the server is running.',
  uploadFailed: 'Upload failed. Please try again.',
  invalidFile: 'Invalid file type or size.',
  serverError: 'Server error. Please try again later.',
  chatError: 'Failed to send message. Please try again.',
  analyzeError: 'Failed to analyze code. Please try again.',
  generateError: 'Failed to generate code. Please try again.',
  versionControlError: 'Version control operation failed. Please try again.',
  authError: 'Authentication error. Please check your API key.',
  timeoutError: 'Request timed out. Please try again.'
};

// Chat Configuration
export const CHAT_CONFIG = {
  maxMessageLength: 4000,
  maxContextLength: 8000,
  retryAttempts: 2,
  retryDelay: 1000,
  debug: true // 启用调试模式
};

// File Types Configuration
export const FILE_TYPES = {
  code: ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp', '.go', '.rs'],
  web: ['.html', '.css', '.scss', '.sass'],
  data: ['.json', '.yaml', '.yml'],
  doc: ['.md', '.txt'],
  image: ['.png', '.jpg', '.jpeg', '.gif', '.svg'],
}; 