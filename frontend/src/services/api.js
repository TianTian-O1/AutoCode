import axios from 'axios';
import { API_URL, UPLOAD_CONFIG, API_ENDPOINTS, ERROR_MESSAGES } from '../config';

// Create axios instance with custom config
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: UPLOAD_CONFIG.timeout,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: false
});

// Add request interceptor for debugging
apiClient.interceptors.request.use(
  config => {
    console.log('API Request:', {
      url: config.url,
      method: config.method,
      data: config.data
    });
    return config;
  },
  error => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

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

// Retry mechanism for failed requests
const retryRequest = async (fn, retries = UPLOAD_CONFIG.retryAttempts) => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && !error.response) {
      await new Promise(resolve => setTimeout(resolve, UPLOAD_CONFIG.retryDelay));
      return retryRequest(fn, retries - 1);
    }
    throw error;
  }
};

// File system operations
export const uploadFile = async (file, path = '') => {
  try {
    if (file.size > UPLOAD_CONFIG.maxFileSize) {
      throw new Error(ERROR_MESSAGES.invalidFile);
    }

    // 处理文件路径和名称
    const fullPath = file.webkitRelativePath || file.name;
    const pathParts = fullPath.split('/');
    const filename = pathParts.pop();  // 获取文件名
    const dirPath = pathParts.join('/');  // 获取目录路径

    // 去掉文件名中的 test_ 前缀
    const newFilename = filename.startsWith('test_') ? filename.substring(5) : filename;

    // 构建新的完整路径
    const newPath = dirPath ? `${dirPath}/${newFilename}` : newFilename;

    // 创建新的 File 对象
    const newFile = new File([file], newPath, { type: file.type });

    const formData = new FormData();
    formData.append('file', newFile);

    const response = await retryRequest(() => 
      apiClient.post(API_ENDPOINTS.upload, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(`Upload progress: ${percentCompleted}%`);
        },
      })
    );

    return response.data;
  } catch (error) {
    console.error('Upload error:', error);
    if (error.response) {
      throw new Error(error.response.data?.error || ERROR_MESSAGES.uploadFailed);
    } else if (error.request) {
      throw new Error(ERROR_MESSAGES.networkError);
    } else {
      throw new Error(error.message || ERROR_MESSAGES.uploadFailed);
    }
  }
};

export const listFiles = async (path = '') => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(API_ENDPOINTS.files, { params: { path } })
    );
    return response.data.files || [];
  } catch (error) {
    console.error('List files error:', error);
    return [];
  }
};

export const getFileContent = async (path) => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(API_ENDPOINTS.fileContent, { params: { path } })
    );
    return response.data.content;
  } catch (error) {
    console.error('Get file content error:', error);
    throw new Error(error.response?.data?.error || ERROR_MESSAGES.serverError);
  }
};

export const deletePath = async (path) => {
  try {
    const response = await retryRequest(() =>
      apiClient.delete(API_ENDPOINTS.files, { params: { path } })
    );
    return response.data;
  } catch (error) {
    console.error('Delete error:', error);
    if (error.response) {
      throw new Error(error.response.data?.error || ERROR_MESSAGES.serverError);
    } else if (error.request) {
      throw new Error(ERROR_MESSAGES.networkError);
    } else {
      throw new Error(error.message);
    }
  }
};

export const getRelevantFiles = async (query) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(API_ENDPOINTS.relevantFiles, { query })
    );
    return response.data || [];
  } catch (error) {
    console.error('Get relevant files error:', error);
    return [];
  }
};

export const recordChange = async (path, type) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(API_ENDPOINTS.changes, { path, type })
    );
    return response.data;
  } catch (error) {
    console.error('Record change error:', error);
    throw new Error(error.response?.data?.error || ERROR_MESSAGES.serverError);
  }
};

export const getProjectStructure = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.get(API_ENDPOINTS.fileStructure)
    );
    return response.data;
  } catch (error) {
    console.error('Get project structure error:', error);
    throw new Error(error.response?.data?.error || ERROR_MESSAGES.serverError);
  }
};

// Chat operations
export const sendChatMessage = async (messages) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(API_ENDPOINTS.chat, { messages })
    );
    return response.data;
  } catch (error) {
    console.error('Chat error:', error);
    if (error.response) {
      throw new Error(error.response.data?.error || ERROR_MESSAGES.serverError);
    } else if (error.request) {
      throw new Error(ERROR_MESSAGES.networkError);
    } else {
      throw new Error(error.message);
    }
  }
};

// Code analysis and generation
export const analyzeCode = async (code, options = {}) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(API_ENDPOINTS.analyze, { code, ...options })
    );
    return response.data;
  } catch (error) {
    console.error('Code analysis error:', error);
    throw new Error(error.response?.data?.error || ERROR_MESSAGES.analyzeError);
  }
};

export const generateCode = async (prompt, options = {}) => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(API_ENDPOINTS.generate, { prompt, ...options })
    );
    return response.data;
  } catch (error) {
    console.error('Code generation error:', error);
    throw new Error(error.response?.data?.error || ERROR_MESSAGES.generateError);
  }
};

// Version control operations
export const undoAction = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(API_ENDPOINTS.undo)
    );
    return response.data;
  } catch (error) {
    console.error('Undo error:', error);
    throw new Error(error.response?.data?.error || ERROR_MESSAGES.versionControlError);
  }
};

export const redoAction = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(API_ENDPOINTS.redo)
    );
    return response.data;
  } catch (error) {
    console.error('Redo error:', error);
    throw new Error(error.response?.data?.error || ERROR_MESSAGES.versionControlError);
  }
};

export const resetProject = async () => {
  try {
    const response = await retryRequest(() =>
      apiClient.post(API_ENDPOINTS.reset)
    );
    return response.data;
  } catch (error) {
    console.error('Reset error:', error);
    throw new Error(error.response?.data?.error || ERROR_MESSAGES.versionControlError);
  }
};

export default apiClient; 