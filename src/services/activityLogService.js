import api from './api';

/**
 * Log an activity in the system
 * @param {string} userId - The ID of the user performing the action
 * @param {string} actionType - Type of action (VAULT_CREATE, FILE_UPLOAD, etc.)
 * @param {string} details - Description of the activity
 * @param {string} [vaultId] - Optional vault ID if action is related to a vault
 * @param {string} [fileId] - Optional file ID if action is related to a file
 */
export async function logActivity(userId, actionType, details, vaultId = null, fileId = null) {
    try {
        const response = await api.post('/activities', {
            userId,
            actionType,
            details,
            vaultId,
            fileId
        });

        return response.data;
    } catch (error) {
        console.error('Error logging activity:', error);
        throw error;
    }
}

/**
 * Fetch activities for a user with pagination
 * @param {string} userId - The ID of the user
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Number of items per page
 */
export async function getActivities(userId, page = 1, limit = 10) {
    try {
        const response = await api.get(`/activities/${userId}?page=${page}&limit=${limit}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching activities:', error);
        throw error;
    }
}

/**
 * Search activities with filters
 * @param {string} userId - The ID of the user
 * @param {string} searchTerm - Search term
 * @param {Object} filters - Filters object
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 */
export async function searchActivities(userId, searchTerm = '', filters = {}, page = 1, limit = 10) {
    try {
        const response = await api.post(`/activities/search/${userId}`, {
            searchTerm,
            filters,
            page,
            limit
        });

        return response.data;
    } catch (error) {
        console.error('Error searching activities:', error);
        throw error;
    }
}

/**
 * Export activities with filters
 * @param {string} userId - The ID of the user
 * @param {Object} filters - Filters object
 * @param {string} format - Export format (csv only)
 * @returns {Blob} - Blob containing exported data
 */
export async function exportActivities(userId, filters = {}, format = 'csv') {
    try {
        const response = await api.post(`/activities/export/${userId}`, {
            filters,
            format: 'csv' // Always use CSV format
        }, {
            responseType: 'blob' // Important for file downloads
        });
        
        // Create a download link
        const blob = new Blob([response.data], { type: 'text/csv' });
        
        // Create a filename with date
        const date = new Date().toISOString().split('T')[0];
        const filename = `activity_logs_${date}.csv`;
        
        // Create download link and trigger download
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        return true;
    } catch (error) {
        console.error('Error exporting activities:', error);
        throw error;
    }
} 