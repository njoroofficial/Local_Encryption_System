import db from '../database.js';
import { supabase } from '../supabaseClient.js';

/**
 * Format activity details with additional context
 */
function formatActivityDetails(activity) {
    let details = activity.details || '';

    if (activity.file_name) {
        details += ` | File: ${activity.file_name}`;
        if (activity.file_type) {
            details += ` (${activity.file_type.toUpperCase()})`;
        }
    }

    if (activity.vault_name) {
        details += ` | Vault: ${activity.vault_name}`;
    }

    return details;
}

/**
 * Log an activity in the system
 * @param {string} userId - The ID of the user performing the action
 * @param {string} actionType - Type of action (VAULT_CREATE, FILE_UPLOAD, etc.)
 * @param {string} details - Description of the activity
 * @param {string} [vaultId] - Optional vault ID if action is related to a vault
 * @param {string} [fileId] - Optional file ID if action is related to a file
 * @param {Object} [req] - Express request object for IP and user agent (optional)
 */
async function logActivity(userId, actionType, details, vaultId = null, fileId = null, req = null) {
    try {
        // Use Supabase to log the activity
        const { data, error } = await supabase
            .from('activity_logs')
            .insert({
                user_id: userId,
                action_type: actionType,
                description: details,
                vault_id: vaultId,
                file_id: fileId,
                ip_address: req?.ip || null,
                user_agent: req?.headers?.['user-agent'] || null
            })
            .select('log_id')
            .single();

        if (error) {
            console.error('Supabase error logging activity:', error);
            throw error;
        }
        
        return data;
    } catch (error) {
        console.error('Error logging activity:', error);
        throw new Error('Failed to log activity');
    }
}

/**
 * Fetch activities for a user with pagination
 * @param {string} userId - The ID of the user
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Number of items per page
 */
async function getActivities(userId, page = 1, limit = 10) {
    if (!userId) {
        throw new Error('User ID is required');
    }

    const offset = (page - 1) * limit;
    
    try {
        // Use Supabase to fetch activities with pagination
        const { data: activities, error: activitiesError, count } = await supabase
            .from('activity_logs')
            .select(`
                log_id,
                action_type,
                description,
                vault_id,
                file_id,
                ip_address,
                user_agent,
                created_at,
                vaults:vault_id(vault_name),
                files:file_id(file_name,file_type,file_size)
            `, { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (activitiesError) {
            console.error('Supabase error fetching activities:', activitiesError);
            throw activitiesError;
        }

        const totalCount = count || 0;
        const totalPages = Math.ceil(totalCount / limit);

        // Format the activities data
        const formattedActivities = activities.map(activity => {
            // Extract vault and file information from the nested objects
            const vault_name = activity.vaults?.vault_name || null;
            const file_name = activity.files?.file_name || null;
            const file_type = activity.files?.file_type || null;
            const file_size = activity.files?.file_size || null;

            return {
                id: activity.log_id,
                actionType: activity.action_type,
                details: activity.description,
                timestamp: activity.created_at,
                vault_id: activity.vault_id,
                file_id: activity.file_id,
                vault_name,
                file_name,
                file_type,
                file_size,
                formattedTime: new Date(activity.created_at).toLocaleString(),
                details: formatActivityDetails({
                    details: activity.description,
                    vault_name,
                    file_name,
                    file_type
                })
            };
        });

        return {
            activities: formattedActivities,
            totalPages,
            totalCount,
            currentPage: page
        };
    } catch (error) {
        console.error('Error in getActivities:', error);
        throw new Error('Failed to fetch activities');
    }
}

/**
 * Search activities with filters
 * @param {string} userId - The ID of the user
 * @param {string} searchTerm - Search term
 * @param {Object} filters - Filters object
 */
async function searchActivities(userId, searchTerm = '', filters = {}, page = 1, limit = 10) {
    if (!userId) {
        throw new Error('User ID is required');
    }

    const offset = (page - 1) * limit;
    try {
        // Start building the Supabase query
        let query = supabase
            .from('activity_logs')
            .select(`
                log_id,
                action_type,
                description,
                vault_id,
                file_id,
                ip_address,
                user_agent,
                created_at,
                vaults:vault_id(vault_name),
                files:file_id(file_name,file_type,file_size)
            `, { count: 'exact' })
            .eq('user_id', userId);

        // Apply search filters
        if (searchTerm) {
            // Using ILIKE for case-insensitive search in description
            query = query.or(`description.ilike.%${searchTerm}%`);
        }

        if (filters.actionType) {
            query = query.eq('action_type', filters.actionType);
        }

        if (filters.startDate) {
            query = query.gte('created_at', filters.startDate);
        }

        if (filters.endDate) {
            query = query.lte('created_at', filters.endDate);
        }

        // Apply sorting and pagination
        const { data: activities, error: activitiesError, count } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (activitiesError) {
            console.error('Supabase error searching activities:', activitiesError);
            throw activitiesError;
        }

        const totalCount = count || 0;
        const totalPages = Math.ceil(totalCount / limit);

        // Format the activities data
        const formattedActivities = activities.map(activity => {
            // Extract vault and file information from the nested objects
            const vault_name = activity.vaults?.vault_name || null;
            const file_name = activity.files?.file_name || null;
            const file_type = activity.files?.file_type || null;
            const file_size = activity.files?.file_size || null;

            return {
                id: activity.log_id,
                actionType: activity.action_type,
                details: activity.description,
                timestamp: activity.created_at,
                vault_id: activity.vault_id,
                file_id: activity.file_id,
                vault_name,
                file_name,
                file_type,
                file_size,
                formattedTime: new Date(activity.created_at).toLocaleString(),
                details: formatActivityDetails({
                    details: activity.description,
                    vault_name,
                    file_name,
                    file_type
                })
            };
        });

        return {
            activities: formattedActivities,
            totalPages,
            totalCount,
            currentPage: page
        };
    } catch (error) {
        console.error('Error searching activities:', error);
        throw new Error('Failed to search activities');
    }
}

export { logActivity, getActivities, searchActivities }; 