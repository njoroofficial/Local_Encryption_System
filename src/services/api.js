import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const API_TIMEOUT = process.env.REACT_APP_API_TIMEOUT || 30000;

const api = axios.create({
  baseURL: API_URL,
  timeout: parseInt(API_TIMEOUT),
  maxContentLength: Infinity,
  maxBodyLength: Infinity
});

// test backend connection
export const testBackendConnection = async () => {
  try {
    const response = await api.get('/test');
    return response.data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// signup route
export const signUp = async (userData) => {
  try {
    const response = await api.post('/auth/signup', userData);
    return response.data;
  } catch (error) {
    throw error.response?.data?.error || 'Signup failed';
  }
};

// signin route
export const signIn = async (credentials) => {
  try {
    console.log('Attempting signin with:', { email: credentials.email });
    const response = await api.post('/auth/signin', credentials);
    
    if (response.data && response.data.user) {
      // Store user data in localStorage
      localStorage.setItem('userData', JSON.stringify(response.data.user));
      
      // Dispatch a custom event for user data change
      window.dispatchEvent(new Event('userDataChange'));
      
      return response.data;
    } else {
      throw new Error('Invalid response format from server');
    }
  } catch (error) {
    console.error('Sign in error:', error.response?.data || error.message);
    throw error.response?.data?.error || 'Sign in failed';
  }
};

export const createVault = async (vaultData) => {
  try {
    const response = await api.post('/vault/create', vaultData);
    return response.data;
  } catch (error) {
    throw error.response?.data?.error || 'Failed to create vault';
  }
};

export const logout = () => {
  localStorage.removeItem('userData');
  // Dispatch a custom event for user data change
  window.dispatchEvent(new Event('userDataChange'));
};

export const fetchUserVaults = async (userId) => {
  try {
    const response = await api.get(`/vaults/${userId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data?.error || 'Failed to fetch vaults';
  }
};

export const deleteVault = async (vaultId, userId) => {
  try {
    console.log('Deleting vault:', vaultId);
    const response = await api.delete(`/vaults/${vaultId}`, {
      data: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('Delete vault error:', error.response?.data || error.message);
    throw error.response?.data?.error || 'Failed to delete vault';
  }
};

export const verifyVaultKey = async (vaultId, vaultKey, userCredentials = null) => {
  try {
    const data = userCredentials 
      ? { ...userCredentials }
      : { vault_key: vaultKey };
      
    const response = await api.post(`/vaults/${vaultId}/verify`, data);
    return response.data;
  } catch (error) {
    throw error.response?.data?.error || 'Failed to verify vault key';
  }
};

export const uploadFile = async (formData, onProgress) => {
  try {
    // Ensure formData includes userId
    if (!formData.get('user_id')) {
      const userData = JSON.parse(localStorage.getItem('userData'));
      if (userData && userData.userId) {
        formData.append('user_id', userData.userId);
      } else {
        throw new Error('User ID is required for file upload');
      }
    }

    // Log all form data for debugging
    console.log('Uploading file with formData:', {
      file: formData.get('file')?.name,
      vaultId: formData.get('vault_id'),
      userId: formData.get('user_id'),
      hasEncryptionKey: !!formData.get('encryption_key'),
      useVaultKey: formData.get('use_vault_key'),
      contentType: formData.get('file')?.type
    });

    const response = await axios.post('http://localhost:5000/api/file/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
      timeout: 60000, // Increase timeout further for large files
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    console.log('Upload response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Upload error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      statusText: error.response?.statusText
    });
    
    // Throw a more descriptive error
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    } else if (error.response?.data?.details) {
      throw new Error(error.response.data.details);
    } else if (error.message) {
      throw new Error(`Upload failed: ${error.message}`);
    } else {
      throw new Error('Failed to upload file');
    }
  }
};

export const fetchFiles = async (vaultId) => {
  try {
    console.log('Fetching files for vault:', vaultId);
    const response = await api.get(`/files/${vaultId}`);
    console.log('API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching files:', error);
    if (error.response?.status === 404) {
      return { files: [] };
    }
    throw error.response?.data?.error || 'Failed to fetch files';
  }
};

export const downloadFile = async (fileId, userId) => {
  try {
    const response = await api.get(`/files/download/${fileId}?userId=${userId}`, {
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    throw error.response?.data?.error || 'Failed to download file';
  }
};

export const previewFile = async (fileId, userId) => {
  try {
    const response = await api.get(`/files/preview/${fileId}?userId=${userId}`);
    return response.data;
  } catch (error) {
    throw error.response?.data?.error || 'Failed to preview file';
  }
};

export const deleteFile = async (fileId, userId) => {
  try {
    const response = await api.delete(`/files/${fileId}`, {
      data: { userId }
    });
    return response.data;
  } catch (error) {
    console.error('Delete file error:', error);
    throw new Error(error.response?.data?.error || 'Failed to delete file');
  }
};

export const changePassword = async (email, currentPassword, newPassword, userId) => {
  try {
    const response = await api.post('/auth/change-password', {
      email,
      currentPassword,
      newPassword,
      userId
    });
    return {
      message: response.data.message,
      passwordChangeDate: response.data.passwordChangeDate
    };
  } catch (error) {
    throw error.response?.data?.error || 'Failed to change password';
  }
};

export const changeVaultKey = async (vaultId, currentKey, newKey, userId) => {
  try {
    const response = await api.post(`/vaults/${vaultId}/change-key`, {
      currentKey,
      newKey,
      userId
    });
    return response.data;
  } catch (error) {
    throw error.response?.data?.error || 'Failed to change vault key';
  }
};

export async function fetchUserFiles(userId) {
  try {
    const response = await fetch(`/api/files/user/${userId}`);
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to fetch files');
    }
    return await response.json();
  } catch (err) {
    throw new Error(err.message || 'Failed to fetch files');
  }
}

export async function changeFileKey(fileId, currentKey, newKey, userId) {
  try {
    const response = await fetch(`/api/files/${fileId}/change-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentKey,
        newKey,
        userId,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to change file key');
    }

    return await response.json();
  } catch (err) {
    throw new Error(err.message || 'Failed to change file key');
  }
}

// Get user activities
export const fetchActivities = async (page = 1, limit = 10) => {
    try {
        const response = await api.get(`/activities?page=${page}&limit=${limit}`);
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.error || 'Failed to fetch activities');
    }
};

// Search activities
export const searchActivities = async (searchTerm, filters = {}) => {
    try {
        const params = new URLSearchParams({
            ...(searchTerm && { searchTerm }),
            ...(filters.actionType && { actionType: filters.actionType }),
            ...(filters.startDate && { startDate: filters.startDate }),
            ...(filters.endDate && { endDate: filters.endDate })
        });
        
        const response = await api.get(`/activities/search?${params}`);
        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.error || 'Failed to search activities');
    }
};

// File decryption route
export const decryptFile = async (fileId, decryptionKey) => {
  try {
    // Get userId from localStorage
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData || !userData.userId) {
      throw new Error('User ID not found');
    }

    const response = await api.post('/file/decrypt', {
      file_id: fileId,
      decryption_key: decryptionKey,
      user_id: userData.userId
    }, {
      responseType: 'blob'
    });

    // If the response is JSON (error), convert it to text
    if (response.headers['content-type']?.includes('application/json')) {
      const text = await response.data.text();
      const error = JSON.parse(text);
      throw new Error(error.error || 'Failed to decrypt file');
    }

    return response.data;
  } catch (error) {
    if (error.response?.data instanceof Blob) {
      const text = await error.response.data.text();
      try {
        const json = JSON.parse(text);
        throw new Error(json.error || 'Failed to decrypt file');
      } catch (e) {
        throw new Error('Failed to decrypt file');
      }
    }
    throw error.response?.data?.error || error.message || 'Failed to decrypt file';
  }
};

// Raw file preview
export const rawPreviewFile = async (fileId, decryptionKey) => {
  try {
    // Get userId from localStorage
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData || !userData.userId) {
      throw new Error('User ID not found');
    }

    const response = await api.get(`/files/raw-preview/${fileId}`, {
      params: {
        decryption_key: decryptionKey,
        userId: userData.userId
      },
      responseType: 'blob'
    });

    // If the response is JSON (error), convert it to text
    if (response.headers['content-type']?.includes('application/json')) {
      const text = await response.data.text();
      const error = JSON.parse(text);
      throw new Error(error.error || 'Failed to preview file');
    }

    return response.data;
  } catch (error) {
    if (error.response?.data instanceof Blob) {
      const text = await error.response.data.text();
      try {
        const json = JSON.parse(text);
        throw new Error(json.error || 'Failed to preview file');
      } catch (e) {
        throw new Error('Failed to preview file');
      }
    }
    throw error.response?.data?.error || error.message || 'Failed to preview file';
  }
};

export default api; 