import axios from 'axios';

// Create axios instance with custom config
const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:5000',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: false
});

// Add response interceptor for debugging
apiClient.interceptors.response.use(
  response => {
    console.log('API Response:', {
      url: response.config.url,
      method: response.config.method,
      status: response.status,
      data: response.data
    });
    return response;
  },
  error => {
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    return Promise.reject(error);
  }
);

// File system operations
export const uploadFile = async (file, path = '') => {
  try {
    console.log(`Starting upload for file: ${file.name} (size: ${file.size} bytes)`);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('path', path);

    console.log('Upload request:', {
      url: 'http://127.0.0.1:5000/api/upload',
      method: 'POST',
      data: {
        file: file.name,
        path: path
      }
    });

    const response = await axios({
      method: 'post',
      url: 'http://127.0.0.1:5000/api/upload',
      data: formData,
      headers: {
        'Accept': 'application/json'
      },
      withCredentials: false,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 300000, // 5 minutes timeout for large files
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        console.log(`Upload progress for ${file.name}: ${percentCompleted}%`);
      },
    });

    console.log(`Upload successful for ${file.name}:`, response.data);
    return response.data;
  } catch (error) {
    console.error('Upload error details:', {
      file: file.name,
      size: file.size,
      path: path,
      error: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    if (error.response) {
      throw new Error(`Upload failed (${error.response.status}): ${error.response.data?.error || error.response.statusText}`);
    } else if (error.request) {
      throw new Error(`Network error: Cannot connect to server. Please check if the server is running.`);
    } else {
      throw new Error(`Upload failed: ${error.message}`);
    }
  }
};

// Other API functions
export const listFiles = async (path = '') => {
  try {
    console.log('API: Listing files, path:', path);
    const response = await apiClient.get('/api/files', { 
      params: { path },
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.data && Array.isArray(response.data.files)) {
      console.log('API: Files loaded successfully:', response.data.files);
      return response.data.files;
    } else {
      console.error('API: Invalid response format:', response.data);
      return [];
    }
  } catch (error) {
    console.error('API: List files error:', error);
    if (error.response) {
      console.error('API: Error response:', error.response.data);
    }
    return [];
  }
};

export const readFile = async (path) => {
  try {
    console.log('Reading file:', path);
    const response = await apiClient.get('/api/files/read', { params: { path } });
    console.log('File read response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Read file error:', error);
    throw error;
  }
};

export const deletePath = async (path) => {
  try {
    console.log(`Deleting path: ${path}`);
    const response = await axios({
      method: 'delete',
      url: 'http://127.0.0.1:5000/api/files',
      params: { path },
      headers: {
        'Accept': 'application/json'
      },
      withCredentials: false
    });
    console.log('Delete response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Delete error details:', {
      error: error.message,
      response: error.response?.data,
      request: error.request ? 'Request was made but no response' : 'Request setup failed',
      config: error.config,
      status: error.response?.status,
      statusText: error.response?.statusText
    });
    
    if (error.response) {
      throw new Error(`Server error (${error.response.status}): ${error.response.data?.error || error.response.statusText}`);
    } else if (error.request) {
      throw new Error('Network error: Cannot connect to server. Please check if the server is running.');
    } else {
      throw new Error(`Request failed: ${error.message}`);
    }
  }
};

export const searchFiles = async (query) => {
  try {
    const response = await apiClient.get('/api/files/search', { params: { query } });
    return response.data.results || [];
  } catch (error) {
    return [];
  }
};

// AI-related functions
export const chat = async (messages) => {
  const response = await apiClient.post('/api/chat', { messages });
  return response.data;
};

export const analyzeCode = async (code) => {
  const response = await apiClient.post('/api/analyze', { code });
  return response.data;
};

export const generateCode = async (prompt) => {
  const response = await apiClient.post('/api/generate', { prompt });
  return response.data;
};

export default apiClient; 