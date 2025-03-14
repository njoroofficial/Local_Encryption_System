import db from '../database.js';

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
        const query = `
            INSERT INTO activity_logs 
            (user_id, action_type, details, vault_id, file_id, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING log_id
        `;

        const values = [
            userId,
            actionType,
            details,
            vaultId,
            fileId,
            req?.ip || null,
            req?.headers?.['user-agent'] || null
        ];

        const result = await db.query(query, values);
        return result.rows[0];
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
    
    const query = `
        SELECT 
            al.log_id as id,
            al.action_type as "actionType",
            al.details,
            al.timestamp,
            al.vault_id,
            al.file_id,
            v.vault_name,
            f.file_name,
            f.file_type,
            f.file_size
        FROM activity_logs al
        LEFT JOIN vaultTable v ON al.vault_id = v.vault_id
        LEFT JOIN fileTable f ON al.file_id = f.file_id
        WHERE al.user_id = $1
        ORDER BY al.timestamp DESC
        LIMIT $2 OFFSET $3
    `;

    const countQuery = `
        SELECT COUNT(*) 
        FROM activity_logs 
        WHERE user_id = $1
    `;

    try {
        const [activities, countResult] = await Promise.all([
            db.query(query, [userId, limit, offset]),
            db.query(countQuery, [userId])
        ]);

        const totalCount = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalCount / limit);

        // Format the activities data
        const formattedActivities = activities.rows.map(activity => ({
            ...activity,
            formattedTime: new Date(activity.timestamp).toLocaleString(),
            details: formatActivityDetails(activity)
        }));

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
        let query = `
            SELECT 
                al.log_id as id,
                al.action_type as "actionType",
                al.details,
                al.timestamp,
                al.vault_id,
                al.file_id,
                v.vault_name,
                f.file_name,
                f.file_type,
                f.file_size
            FROM activity_logs al
            LEFT JOIN vaultTable v ON al.vault_id = v.vault_id
            LEFT JOIN fileTable f ON al.file_id = f.file_id
            WHERE al.user_id = $1
        `;

        let countQuery = `
            SELECT COUNT(*) 
            FROM activity_logs al
            LEFT JOIN vaultTable v ON al.vault_id = v.vault_id
            LEFT JOIN fileTable f ON al.file_id = f.file_id
            WHERE al.user_id = $1
        `;

        const values = [userId];
        const countValues = [userId];
        let paramCount = 1;

        if (searchTerm) {
            paramCount++;
            const searchCondition = ` AND (
                al.details ILIKE $${paramCount} OR 
                v.vault_name ILIKE $${paramCount} OR 
                f.file_name ILIKE $${paramCount}
            )`;
            query += searchCondition;
            countQuery += searchCondition;
            values.push(`%${searchTerm}%`);
            countValues.push(`%${searchTerm}%`);
        }

        if (filters.actionType) {
            paramCount++;
            const actionCondition = ` AND al.action_type = $${paramCount}`;
            query += actionCondition;
            countQuery += actionCondition;
            values.push(filters.actionType);
            countValues.push(filters.actionType);
        }

        if (filters.startDate) {
            paramCount++;
            const startDateCondition = ` AND al.timestamp >= $${paramCount}`;
            query += startDateCondition;
            countQuery += startDateCondition;
            values.push(filters.startDate);
            countValues.push(filters.startDate);
        }

        if (filters.endDate) {
            paramCount++;
            const endDateCondition = ` AND al.timestamp <= $${paramCount}`;
            query += endDateCondition;
            countQuery += endDateCondition;
            values.push(filters.endDate);
            countValues.push(filters.endDate);
        }

        query += ' ORDER BY al.timestamp DESC';
        query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
        values.push(limit, offset);

        const [activities, countResult] = await Promise.all([
            db.query(query, values),
            db.query(countQuery, countValues)
        ]);

        const totalCount = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalCount / limit);

        // Format the activities data
        const formattedActivities = activities.rows.map(activity => ({
            ...activity,
            formattedTime: new Date(activity.timestamp).toLocaleString(),
            details: formatActivityDetails(activity)
        }));

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