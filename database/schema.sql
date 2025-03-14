-- Activity Logs Table
CREATE TABLE activity_logs (
    log_id SERIAL PRIMARY KEY,
    user_id character varying(50) REFERENCES userregistration(user_id),
    action_type character varying(50) NOT NULL,
    details text NOT NULL,
    timestamp timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    vault_id character varying(50) REFERENCES vaulttable(vault_id) ON DELETE SET NULL,
    file_id character varying(50) REFERENCES filetable(file_id) ON DELETE SET NULL,
    ip_address inet,
    user_agent text
);

-- Create index for faster querying
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_timestamp ON activity_logs(timestamp);
CREATE INDEX idx_activity_logs_action_type ON activity_logs(action_type);

-- Create enum for action types (optional but recommended)
CREATE TYPE activity_action_type AS ENUM (
    'VAULT_CREATE',
    'VAULT_ACCESS',
    'VAULT_DELETE',
    'VAULT_KEY_CHANGE',
    'FILE_UPLOAD',
    'FILE_PREVIEW',
    'FILE_DOWNLOAD',
    'FILE_DELETE',
    'FILE_KEY_CHANGE',
    'PASSWORD_CHANGE'
); 