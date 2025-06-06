import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const API_TIMEOUT = process.env.REACT_APP_API_TIMEOUT || 30000;

// Log API configuration for debugging
console.log('API Configuration:', { 
  baseURL: API_URL, 
  timeout: parseInt(API_TIMEOUT),
  envUrl: process.env.REACT_APP_API_URL
});

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
  // check if userData is valid
  try {
    console.log('Attempting signup with:', { 
      email: userData.email,
      firstName: userData.first_name,
      url: `${API_URL}/auth/signup`
    });
    
    const response = await api.post('/auth/signup', userData);
    console.log('Signup successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Signup error details:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: error.config
    });
    
    // More detailed error handling
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Server responded with error:', error.response.data);
      throw error.response.data.error || 'Signup failed: Server error';
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from server');
      throw new Error('Signup failed: No response from server. Check if backend is running.');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request:', error.message);
      throw error.message || 'Signup failed';
    }
  }
};

// signin route
export const signIn = async (credentials) => {
  try {
    console.log('Attempting signin with:', { email: credentials.email });
    const response = await api.post('/auth/signin', credentials);
    
    // Log the full response for debugging
    console.log('Signin response from server:', {
      message: response.data.message,
      userData: response.data.user
    });
    
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
    console.error('Signin error:', error);
    if (error.response && error.response.data) {
      throw error.response.data;
    }
    throw error;
  }
};

// resend verification email
export const resendVerificationEmail = async (email) => {
  try {
    const response = await api.post('/auth/resend-verification', { email });
    return response.data;
  } catch (error) {
    console.error('Resend verification error:', error);
    if (error.response && error.response.data) {
      throw error.response.data;
    }
    throw error;
  }
};

export const createVault = async (vaultData) => {
  try {
    console.log('Creating vault with data:', {
      vaultName: vaultData.vault_name,
      userId: vaultData.user_id,
      hasVaultKey: !!vaultData.vault_key
    });
    
    const response = await api.post('/vault/create', vaultData);
    console.log('Vault created successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Vault creation error:', error.response?.data || error.message);
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
    console.log('Fetching vaults for user:', userId);
    const response = await api.get(`/vaults/${userId}`);
    console.log('Fetched vaults:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching vaults:', error.response?.data || error.message);
    throw error.response?.data?.error || 'Failed to fetch vaults';
  }
};

// Verify vault key before deletion
export const verifyVaultDelete = async (vaultId, vaultKey) => {
  try {
    // Get userId from localStorage
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData || !userData.userId) {
      throw new Error('User ID not found');
    }

    const response = await api.post('/vault/verify-delete', {
      vault_id: vaultId,
      vault_key: vaultKey,
      user_id: userData.userId
    });

    console.log('Vault key verification successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Vault key verification error:', error);
    throw new Error(error.response?.data?.error || 'Failed to verify vault key');
  }
};

export const deleteVault = async (vaultId, userId) => {
  try {
    // Validate parameters
    if (!vaultId) {
      throw new Error('Vault ID is required');
    }
    if (!userId) {
      throw new Error('User ID is required');
    }

    console.log('Deleting vault:', {
      vaultId,
      userId,
      requestUrl: `${API_URL}/vaults/${vaultId}`
    });
    
    const response = await api.delete(`/vaults/${vaultId}`, {
      data: { 
        userId: userId, 
        user_id: userId // Include both formats to be safe
      }
    });
    
    console.log('Vault deleted successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Delete vault error:', {
      message: error.message,
      responseData: error.response?.data,
      status: error.response?.status
    });
    throw error.response?.data?.error || 'Failed to delete vault';
  }
};

export const verifyVaultKey = async (vaultId, vaultKey, userCredentials = null) => {
  try {
    console.log('Verifying access to vault:', vaultId);
    const data = userCredentials 
      ? { ...userCredentials }
      : { vault_key: vaultKey };
      
    const response = await api.post(`/vaults/${vaultId}/verify`, data);
    console.log('Vault access verified successfully');
    return response.data;
  } catch (error) {
    console.error('Vault verification error:', error.response?.data || error.message);
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

    const response = await axios.post(`${API_URL}/file/upload`, formData, {
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
    
    throw new Error(error.response?.data?.details || error.message || 'Failed to upload file');
  }
};

export const fetchFiles = async (vaultId) => {
  try {
    console.log('Fetching files for vault:', vaultId);
    const response = await api.get(`/files/${vaultId}`);
    
    // Ensure encryption_type is available in file data
    if (response.data && response.data.files) {
      response.data.files = response.data.files.map(file => ({
        ...file,
        encryption_type: file.encryption_type || 'custom' // Default to custom if missing
      }));
    }
    
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

// File decryption route
export const decryptFile = async (fileId, decryptionKey, isDownload = false) => {
  try {
    // Get userId from localStorage
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData || !userData.userId) {
      throw new Error('User ID not found');
    }

    const response = await api.post('/file/decrypt', {
      file_id: fileId,
      decryption_key: decryptionKey,
      user_id: userData.userId,
      is_download: isDownload // Add flag to indicate if this is a download operation
    }, {
      responseType: 'blob'
    });

    // If the response is JSON (error), convert it to text
    if (response.headers['content-type']?.includes('application/json')) {
      const text = await response.data.text();
      const error = JSON.parse(text);
      throw new Error(error.error || 'Failed to decrypt file');
    }
    
    // If this is a download operation, log it separately
    if (isDownload) {
      try {
        await logFileDownload(fileId);
      } catch (logError) {
        console.error('Failed to log download activity:', logError);
        // Continue anyway as the download was successful
      }
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

// Log file download activity
export const logFileDownload = async (fileId) => {
  try {
    // Get userId from localStorage
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData || !userData.userId) {
      throw new Error('User ID not found');
    }
    
    // Get file info - we need this to get the vault ID
    const { data: files } = await api.get(`/files/${fileId}/info`);
    const file = files.file;
    
    if (!file) {
      throw new Error('File information not found');
    }
    
    // Log the download activity
    await api.post('/activities', {
      userId: userData.userId,
      actionType: 'FILE_DOWNLOAD',
      details: `Downloaded file: ${file.fileName}`,
      vaultId: file.vaultId,
      fileId: fileId
    });
    
    return true;
  } catch (error) {
    console.error('Error logging file download:', error);
    throw error;
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

// Verify file decryption key before deletion
export const verifyFileDelete = async (fileId, decryptionKey) => {
  try {
    // Get userId from localStorage
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData || !userData.userId) {
      throw new Error('User ID not found');
    }

    const response = await api.post('/file/verify-delete', {
      file_id: fileId,
      decryption_key: decryptionKey,
      user_id: userData.userId
    });

    console.log('Decryption key verification successful:', response.data);
    return response.data;
  } catch (error) {
    console.error('Decryption key verification error:', error);
    throw new Error(error.response?.data?.error || 'Failed to verify decryption key');
  }
};

export const deleteFile = async (fileId) => {
  try {
    // Get userId from localStorage
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData || !userData.userId) {
      throw new Error('User ID not found');
    }

    const response = await api.delete(`/file/delete/${fileId}`, {
      data: { user_id: userData.userId }
    });

    console.log('File deletion successful:', response.data);
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
    console.log(`Sending vault key change request for vault: ${vaultId}`);
    
    const response = await api.post(`/vaults/${vaultId}/change-key`, {
      currentKey,
      newKey,
      userId
    });
    
    console.log('Vault key change response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Vault key change API error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    // Try to extract a detailed error message from the response
    const errorDetails = error.response?.data?.details || '';
    const errorMessage = error.response?.data?.error || 'Failed to change vault key';
    
    throw new Error(errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage);
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

export const changeFileKey = async (fileId, currentKey, newKey) => {
  try {
    console.log(`Sending file key change request for file: ${fileId}`);
    
    // Get userId from localStorage
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData || !userData.userId) {
      throw new Error('User ID not found. Please log in again.');
    }
    
    const response = await api.post(`/files/${fileId}/change-key`, {
      currentKey,
      newKey,
      userId: userData.userId
    });
    
    console.log('File key change response:', response.data);
    return response.data;
  } catch (error) {
    console.error('File key change API error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    
    // Try to extract a detailed error message from the response
    const errorDetails = error.response?.data?.details || '';
    const errorMessage = error.response?.data?.error || 'Failed to change file encryption key';
    
    throw new Error(errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage);
  }
};

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


export default api; 