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