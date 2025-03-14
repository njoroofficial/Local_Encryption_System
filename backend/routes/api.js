import express from "express";
import { body, validationResult } from 'express-validator';
import db from "../database.js";
import bcrypt from "bcrypt";
import upload from "../fileUpload.js";
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import XLSX from 'xlsx';
import { encryptFile, decryptFile } from '../encryptionLogic.js';
import { logActivity, getActivities, searchActivities } from '../services/activityLogService.js';

const router = express.Router();


// Test route for connection verification
router.get('/test', (req, res) => {
  res.json({ message: 'Backend is connected!' });
});

// test database connection routes
router.get('/test-db', async (req, res) => {
  try {
    // Test database connection
    const testQuery = await db.query('SELECT NOW()');
    console.log('Database connection successful');

    // Test userRegistration table
    const userTableQuery = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'userregistration'
    `);
    
    res.json({
      status: 'success',
      dbConnected: true,
      timestamp: testQuery.rows[0].now,
      userTableColumns: userTableQuery.rows
    });
  } catch (err) {
    console.error('Database test error:', err);
    res.status(500).json({
      status: 'error',
      error: err.message,
      details: 'Database connection or query failed'
    });
  }
});

// signup auth route
router.post('/auth/signup',
  [
    // Validate email
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address'),

    // Validate password
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
      .withMessage('Password must contain at least one letter and one number'),
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { username, email, password } = req.body;

    try {
      // Step 1: Check if the email already exists
      const emailCheckQuery = await db.query('SELECT * FROM userRegistration WHERE email = $1', [email]);
      if (emailCheckQuery.rows.length > 0) {
        return res.status(400).json({ 
          error: 'Email already exists',
          details: 'The provided email is already associated with an existing account.'
        });
      }

      // Get the current count of users
      const userCountQuery = await db.query('SELECT COUNT(*) FROM userRegistration');
      const userCount = parseInt(userCountQuery.rows[0].count, 10); 

      // Generate the next user ID
      const userId = `user${userCount + 1}`; // e.g., user1

      // Hash the password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Insert the new user into the database
      const newUser = await db.query(
        'INSERT INTO userRegistration (user_id, fullname, email, password) VALUES ($1, $2, $3, $4) RETURNING *',
        [userId, username, email, hashedPassword]
      );

      // Send a success response
      res.status(201).json({ 
        message: 'User registered successfully!', 
        user: {
          userId: newUser.rows[0].user_id,
          fullname: newUser.rows[0].fullname,
          email: newUser.rows[0].email
        }
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// signin auth route
router.post('/auth/signin', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    console.log('Signin attempt for email:', email);

    // Input validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if the user exists
    const userQuery = await db.query('SELECT * FROM userRegistration WHERE email = $1', [email]);
    console.log('User found:', !!userQuery.rows.length);

    if (userQuery.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userQuery.rows[0];

    // Compare the provided password with the hashed password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    try {
      // Update last login timestamp
      const now = new Date().toISOString();
      const updateResult = await db.query(
        'UPDATE userRegistration SET last_login = $1 WHERE user_id = $2 RETURNING last_login, password_change',
        [now, user.user_id]
      );

      console.log('Login successful, returning user data');

      // Return a success response
      res.status(200).json({
        message: 'Signin successful!',
        user: {
          userId: user.user_id,
          fullname: user.fullname,
          email: user.email,
          lastLogin: updateResult.rows[0]?.last_login || now,
          passwordChangeDate: updateResult.rows[0]?.password_change || null
        }
      });
    } catch (updateErr) {
      // If updating last_login fails, still allow login but log the error
      console.error('Error updating last_login:', updateErr);
      res.status(200).json({
        message: 'Signin successful!',
        user: {
          userId: user.user_id,
          fullname: user.fullname,
          email: user.email,
          lastLogin: null,
          passwordChangeDate: null
        }
      });
    }
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Creating Vault auth route
router.post('/vault/create',
  [
    // Validate vault name
    body('vault_name')
      .notEmpty()
      .withMessage('Vault name is required'),

    // Validate vault key
    body('vault_key')
      .notEmpty()
      .withMessage('Vault key is required'),
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { vault_name, vault_key, user_id } = req.body;

    try {
      // Check if the user exists
      const userQuery = await db.query('SELECT * FROM userRegistration WHERE user_id = $1', [user_id]);
      if (userQuery.rows.length === 0) {
        return res.status(400).json({ error: 'User does not exist' });
      }

      // Get the maximum vault number and increment it
      const maxVaultQuery = await db.query(
        "SELECT MAX(CAST(SUBSTRING(vault_id FROM 'vault([0-9]+)') AS INTEGER)) as max_num FROM vaultTable"
      );
      
      const maxNum = maxVaultQuery.rows[0].max_num || 0;
      const newVaultNum = maxNum + 1;
      const vaultId = `vault${newVaultNum}`;

      // Hash the vault key
      const saltRounds = 10;
      const hashedVaultKey = await bcrypt.hash(vault_key, saltRounds);

      // Insert the new vault into the database
      const newVault = await db.query(
        'INSERT INTO vaultTable (vault_id, vault_name, vault_key, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [vaultId, vault_name, hashedVaultKey, user_id]
      );

      // Log the activity
      await logActivity(
        user_id,
        'VAULT_CREATE',
        `Created new vault: ${vault_name}`,
        vaultId,
        null,
        req
      );

      // Send a success response
      res.status(201).json({
        message: 'Vault created successfully!',
        vault: {
          vaultId: newVault.rows[0].vault_id,
          vaultName: newVault.rows[0].vault_name,
          userId: newVault.rows[0].user_id,
          createdAt: newVault.rows[0].created_at
        }
      });
    } catch (err) {
      console.error('Vault creation error:', err.message);
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  }
);

// Get vaults for a user
router.get('/vaults/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // Step 1: Validate the userId
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Step 2: Check if the user exists
    const userQuery = await db.query('SELECT * FROM userRegistration WHERE user_id = $1', [userId]);
    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Step 3: Get all vaults for the user with file details
    const vaultsQuery = await db.query(
      `SELECT 
        v.vault_id,
        v.vault_name,
        v.created_at,
        COUNT(f.file_id) as files_count,
        COALESCE(SUM(f.file_size), 0) as total_size,
        MAX(f.created_at) as last_accessed
      FROM vaultTable v
      LEFT JOIN fileTable f ON v.vault_id = f.vault_id
      WHERE v.user_id = $1
      GROUP BY v.vault_id, v.vault_name, v.created_at
      ORDER BY v.created_at DESC`,
      [userId]
    );

    // Step 4: Format the response
    const vaults = vaultsQuery.rows.map(vault => ({
      id: vault.vault_id,
      name: vault.vault_name,
      createdAt: new Date(vault.created_at).toLocaleString(), // Format creation date
      filesCount: vault.files_count || 0,
      totalSize: vault.total_size || 0, // Total size of files in bytes
      lastAccessed: vault.last_accessed 
        ? new Date(vault.last_accessed).toLocaleString() // Format last accessed date
        : 'Never', // Default if no files exist
    }));

    // Step 5: Send the response
    if (vaults.length === 0) {
      return res.status(200).json({ message: 'No vaults found for this user', vaults: [] });
    }

    res.status(200).json({ vaults });
  } catch (err) {
    console.error('Error fetching vaults:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Delete vault route
router.delete('/vaults/:vaultId', async (req, res) => {
  const { vaultId } = req.params;
  const { userId } = req.body; // Add userId to request body

  try {
    // First check if the vault exists
    const vaultCheck = await db.query(
      'SELECT * FROM vaultTable WHERE vault_id = $1',
      [vaultId]
    );
    
    if (vaultCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Vault not found' });
    }

    const vault = vaultCheck.rows[0];

    // Log the vault deletion before actually deleting
    if (userId) {
      await logActivity(
        userId,
        'VAULT_DELETE',
        `Deleted vault: ${vault.vault_name}`,
        vaultId,
        null,
        req
      );
    }

    // Delete associated files first (due to foreign key constraint)
    await db.query('DELETE FROM fileTable WHERE vault_id = $1', [vaultId]);
    
    // Then delete the vault
    await db.query('DELETE FROM vaultTable WHERE vault_id = $1', [vaultId]);

    res.json({ message: 'Vault deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Vault verification/access route
router.post('/vaults/:vaultId/verify', async (req, res) => {
  const { vaultId } = req.params;
  const { vault_key, email, password } = req.body;

  try {
    // Get the vault and its details
    const vaultQuery = await db.query(
      `SELECT 
        v.vault_key, 
        v.user_id, 
        v.vault_name,
        u.email, 
        u.password as user_password 
      FROM vaultTable v 
      JOIN userRegistration u ON v.user_id = u.user_id 
      WHERE v.vault_id = $1`,
      [vaultId]
    );
    
    if (vaultQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Vault not found' });
    }

    const vault = vaultQuery.rows[0];

    // If email and password are provided, verify user credentials
    if (email && password) {
      if (email !== vault.email || !await bcrypt.compare(password, vault.user_password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Log vault access via user credentials
      await logActivity(
        vault.user_id,
        'VAULT_ACCESS',
        `Accessed vault: ${vault.vault_name} via user credentials`,
        vaultId,
        null,
        req
      );

      return res.json({ 
        message: 'Access granted via user verification',
        vault: {
          id: vaultId,
          name: vault.vault_name,
          vault_key: vault_key
        }
      });
    }

    // Verify vault key
    const isKeyValid = await bcrypt.compare(vault_key, vault.vault_key);
    if (!isKeyValid) {
      return res.status(401).json({ error: 'Invalid vault key' });
    }

    // Log vault access via vault key
    await logActivity(
      vault.user_id,
      'VAULT_ACCESS',
      `Accessed vault: ${vault.vault_name} via vault key`,
      vaultId,
      null,
      req
    );

    res.json({ 
      message: 'Vault key verified successfully',
      vault: {
        id: vaultId,
        name: vault.vault_name,
        vault_key: vault_key
      }
    });
  } catch (err) {
    console.error('Vault key verification error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// File upload route
router.post('/file/upload', upload.single('file'), async (req, res) => {
  try {
    // Enhanced request logging
    console.log('File upload request received:', {
      file: req.file ? {
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        path: req.file.path
      } : null,
      body: {
        vault_id: req.body.vault_id,
        user_id: req.body.user_id,
        has_encryption_key: !!req.body.encryption_key,
        use_vault_key: req.body.use_vault_key
      }
    });

    const file = req.file;
    const { vault_id, encryption_key, user_id } = req.body;
    const use_vault_key = req.body.use_vault_key === 'true';

    // Enhanced validation with specific error messages
    if (!file) {
      throw new Error('No file uploaded');
    }
    if (!vault_id) {
      throw new Error('Vault ID is required');
    }
    if (!encryption_key) {
      throw new Error('Encryption key is required');
    }
    if (!user_id) {
      throw new Error('User ID is required');
    }

    // Check if vault exists and get vault details
    const vaultQuery = await db.query(
      'SELECT * FROM vaultTable WHERE vault_id = $1 AND user_id = $2',
      [vault_id, user_id]
    );
    
    if (vaultQuery.rows.length === 0) {
      throw new Error('Vault not found or unauthorized access');
    }

    // If using vault key, verify that the provided key matches the vault key
    if (use_vault_key) {
      const isVaultKeyValid = await bcrypt.compare(encryption_key, vaultQuery.rows[0].vault_key);
      if (!isVaultKeyValid) {
        throw new Error('Invalid vault key');
      }
    }

    try {
      // Read and encrypt file
      console.log('Reading file:', file.path);
      const fileBuffer = fs.readFileSync(file.path);
      
      console.log('Encrypting file...');
      const { iv, encryptedData } = encryptFile(fileBuffer, encryption_key);
      
      // Generate file ID
      const fileIdQuery = await db.query(`
        SELECT COALESCE(MAX(CAST(SUBSTRING(file_id FROM 'file([0-9]+)') AS INTEGER)), 0) + 1 AS next_id
        FROM fileTable
      `);
      const nextFileId = fileIdQuery.rows[0].next_id;
      const fileId = `file${nextFileId}`;
      
      // Generate key ID
      const keyIdQuery = await db.query(`
        SELECT COALESCE(MAX(CAST(SUBSTRING(key_id FROM 'key([0-9]+)') AS INTEGER)), 0) + 1 AS next_id
        FROM fileEncryptionKeys
      `);
      const nextKeyId = keyIdQuery.rows[0].next_id;
      const keyId = `key${nextKeyId}`;
      
      // Save encrypted file
      const encryptedFilename = `encrypted-${fileId}${path.extname(file.originalname)}`;
      const uploadsDir = path.join(process.cwd(), 'uploads');
      
      // Ensure uploads directory exists
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const encryptedFilePath = path.join(uploadsDir, encryptedFilename);
      console.log('Saving encrypted file to:', encryptedFilePath);
      fs.writeFileSync(encryptedFilePath, encryptedData, 'hex');

      // Store file details in database
      await db.query(
        `INSERT INTO fileTable (
          file_id, file_name, file_type, file_size, 
          vault_id, file_path, iv, encryption_type
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          fileId,
          file.originalname,
          path.extname(file.originalname).slice(1),
          file.size,
          vault_id,
          encryptedFilePath,
          iv,
          use_vault_key ? 'vault' : 'custom'
        ]
      );

      // Store encryption key
      const hashedKey = await hashEncryptionKey(encryption_key);
      await db.query(
        `INSERT INTO fileEncryptionKeys (key_id, file_id, hashed_key) 
         VALUES ($1, $2, $3)`,
        [keyId, fileId, hashedKey]
      );

      // Log the activity
      await logActivity(
        user_id,
        'FILE_UPLOAD',
        `Uploaded file: ${file.originalname}`,
        vault_id,
        fileId,
        req
      );

      // Clean up the temporary file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      res.json({ fileId, keyId });
    } catch (error) {
      // Clean up temporary file on error
      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload file',
      details: error.message
    });
  }
});

// Update the file decrypt route
router.post('/file/decrypt', async (req, res) => {
  const { file_id, decryption_key, user_id } = req.body;

  try {
    // Validate user_id
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get file and encryption details
    const fileQuery = await db.query(
      'SELECT f.*, k.hashed_key, v.vault_name FROM fileTable f JOIN fileEncryptionKeys k ON f.file_id = k.file_id JOIN vaultTable v ON f.vault_id = v.vault_id WHERE f.file_id = $1',
      [file_id]
    );

    if (fileQuery.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileQuery.rows[0];

    // Read the encrypted file
    const encryptedData = fs.readFileSync(file.file_path, 'hex');
    
    try {
      // Decrypt the file
      const decryptedData = decryptFile(encryptedData, decryption_key, file.iv);
      
      // Log successful decryption BEFORE sending response
      await logActivity(
        user_id,
        'FILE_DECRYPT',
        `Decrypted file: ${file.file_name} from vault: ${file.vault_name}`,
        file.vault_id,
        file_id,
        req
      );
      
      // For text files, convert to UTF-8 string
      if (file.file_type.toLowerCase() === 'txt') {
        const textContent = decryptedData.toString('utf-8');
        return res.json({ content: textContent });
      }

      // For Office documents and other files
      const contentType = getContentType(file.file_type);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${file.file_name}"`);
      
      // Send decrypted data as buffer
      res.send(Buffer.from(decryptedData));
    } catch (decryptError) {
      console.error('Decryption failed:', decryptError);
      return res.status(400).json({ error: 'Invalid decryption key' });
    }
  } catch (err) {
    console.error('File decryption error:', err);
    res.status(500).json({ error: 'Failed to decrypt file' });
  }
});

// function to verify encryption key
async function verifyEncryptionKey(providedKey, hashedKey) {
  try {
    // Use bcrypt to compare the provided key with the hashed key
    return await bcrypt.compare(providedKey, hashedKey);
  } catch (err) {
    console.error('Error verifying encryption key:', err);
    return false;
  }
}

// function to hash encryption key
async function hashEncryptionKey(key) {
  const saltRounds = 10;
  return await bcrypt.hash(key, saltRounds);
}

// Update the files fetch route
router.get('/files/:vaultId', async (req, res) => {
  const { vaultId } = req.params;

  try {
    // Check if the vault exists
    const vaultCheck = await db.query('SELECT * FROM vaultTable WHERE vault_id = $1', [vaultId]);
    if (vaultCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Vault not found' });
    }

    // Get all files for the vault
    const filesQuery = await db.query(
      `SELECT 
        file_id as "fileId",
        file_name as "fileName",
        file_type as "fileType",
        file_size as "fileSize",
        file_path as "filePath",
        created_at as "createdAt"
      FROM fileTable 
      WHERE vault_id = $1 
      ORDER BY created_at DESC`,
      [vaultId]
    );

    // Return empty array if no files found
    res.json({ files: filesQuery.rows });
  } catch (err) {
    console.error('Error fetching files:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// File preview route
router.get('/files/preview/:fileId', async (req, res) => {
  const { fileId } = req.params;
  const { userId, decryption_key } = req.query;

  try {
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const fileQuery = await db.query(
      'SELECT f.*, v.vault_name FROM fileTable f JOIN vaultTable v ON f.vault_id = v.vault_id WHERE file_id = $1',
      [fileId]
    );

    if (fileQuery.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileQuery.rows[0];

    // Log file preview BEFORE handling the preview
    await logActivity(
      userId,
      'FILE_PREVIEW',
      `Previewed file: ${file.file_name} in vault: ${file.vault_name}`,
      file.vault_id,
      fileId,
      req
    );

    const filePath = file.file_path;
    const fileName = file.file_name;
    const fileType = path.extname(fileName).toLowerCase().replace('.', '');

    console.log('File Type:', fileType);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    // Handle Word DOCX files
    if (fileType === 'docx') {
      try {
        if (!decryption_key) {
          return res.status(400).json({ error: 'Decryption key is required for preview' });
        }

        // Create a temporary preview URL that includes the decryption key
        const previewUrl = `/files/preview/${fileId}?decryption_key=${encodeURIComponent(decryption_key)}`;
        
        // Create Office Online Viewer URL
        const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`;
        
        // Return HTML that embeds the Office Online Viewer
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>${fileName}</title>
              <style>
                body, html {
                  margin: 0;
                  padding: 0;
                  height: 100%;
                  overflow: hidden;
                }
                iframe {
                  width: 100%;
                  height: 100%;
                  border: none;
                }
              </style>
            </head>
            <body>
              <iframe src="${officeViewerUrl}" frameborder="0"></iframe>
            </body>
          </html>
        `;
        
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        return res.send(html);
      } catch (error) {
        console.error('DOCX Preview Error:', error);
        return res.status(500).json({ 
          error: 'Error previewing DOCX file',
          details: error.message
        });
      }
    }

    // Handle Excel XLSX/XLS files
    if (['xls', 'xlsx'].includes(fileType)) {
      try {
        const workbook = XLSX.readFile(filePath);
        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
          return res.status(400).json({ error: 'Excel file contains no sheets' });
        }

        const html = XLSX.utils.sheet_to_html(workbook.Sheets[firstSheetName]);
        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
      } catch (error) {
        console.error('XLSX Error:', error);
        return res.status(500).json({ error: 'Error processing Excel file' });
      }
    }

    return res.status(400).json({ error: `Preview for .${fileType} is not supported` });

  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update the raw preview route
router.get('/files/raw-preview/:fileId', async (req, res) => {
  const { fileId } = req.params;
  const { decryption_key, userId } = req.query;

  try {
    // Validate user_id
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get file and encryption details
    const fileQuery = await db.query(
      'SELECT f.*, k.hashed_key, v.vault_name FROM fileTable f JOIN fileEncryptionKeys k ON f.file_id = k.file_id JOIN vaultTable v ON f.vault_id = v.vault_id WHERE f.file_id = $1',
      [fileId]
    );

    if (fileQuery.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileQuery.rows[0];

    // Read the encrypted file
    const encryptedData = fs.readFileSync(file.file_path, 'hex');
    
    try {
      // Decrypt the file
      const decryptedData = decryptFile(encryptedData, decryption_key, file.iv);
      
      // Log successful decryption BEFORE sending response
      await logActivity(
        userId,
        'FILE_DECRYPT',
        `Decrypted file for preview: ${file.file_name} from vault: ${file.vault_name}`,
        file.vault_id,
        fileId,
        req
      );
      
      // Set appropriate headers for the file
      res.setHeader('Content-Type', getContentType(file.file_type));
      res.setHeader('Content-Disposition', `inline; filename="${file.file_name}"`);
      
      // Send the decrypted file
      return res.send(Buffer.from(decryptedData));
    } catch (decryptError) {
      console.error('Decryption failed:', decryptError);
      return res.status(400).json({ error: 'Invalid decryption key' });
    }
  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).json({ error: 'Failed to preview file' });
  }
});

// function to determine content type
function getContentType(fileType) {
  const contentTypes = {
    // Images
    'pdf': 'application/pdf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    // Documents
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt': 'text/plain',
    // Spreadsheets
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Presentations
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  };
  return contentTypes[fileType.toLowerCase()] || 'application/octet-stream';
}

// File download route
router.get('/files/download/:fileId', async (req, res) => {
  const { fileId } = req.params;
  const { decryption_key, userId } = req.query;

  try {
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const fileQuery = await db.query(
      'SELECT f.*, v.vault_name FROM fileTable f JOIN vaultTable v ON f.vault_id = v.vault_id WHERE file_id = $1',
      [fileId]
    );

    if (fileQuery.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileQuery.rows[0];

    // Read the encrypted file
    const encryptedData = fs.readFileSync(file.file_path, 'hex');
    
    try {
      // Decrypt the file
      const decryptedData = decryptFile(encryptedData, decryption_key, file.iv);
      
      // Log file download BEFORE sending the file
      await logActivity(
        userId,
        'FILE_DOWNLOAD',
        `Downloaded file: ${file.file_name} from vault: ${file.vault_name}`,
        file.vault_id,
        fileId,
        req
      );
      
      // Set headers for download
      res.setHeader('Content-Type', getContentType(file.file_type));
      res.setHeader('Content-Disposition', `attachment; filename="${file.file_name}"`);
      
      // Send the decrypted file
      res.send(Buffer.from(decryptedData));
    } catch (decryptError) {
      console.error('Decryption failed:', decryptError);
      return res.status(400).json({ error: 'Invalid decryption key' });
    }
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Delete file route
router.delete('/files/:fileId', async (req, res) => {
  const { fileId } = req.params;
  const { userId } = req.body;

  try {
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get file details first
    const fileQuery = await db.query(
      'SELECT f.*, v.vault_name FROM fileTable f JOIN vaultTable v ON f.vault_id = v.vault_id WHERE file_id = $1',
      [fileId]
    );

    if (fileQuery.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileQuery.rows[0];

    // Log file deletion before actually deleting
    await logActivity(
      userId,
      'FILE_DELETE',
      `Deleted file: ${file.file_name} from vault: ${file.vault_name}`,
      file.vault_id,
      fileId,
      req
    );

    // Delete the file from storage
    if (fs.existsSync(file.file_path)) {
      fs.unlinkSync(file.file_path);
    }

    // Delete from database (cascade will handle fileEncryptionKeys deletion)
    await db.query('DELETE FROM fileTable WHERE file_id = $1', [fileId]);

    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    console.error('Error deleting file:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Change password route
router.post('/auth/change-password', async (req, res) => {
  const { email, currentPassword, newPassword, userId } = req.body;
  
  try {
    console.log('Password change attempt for:', { email, userId });

    // Input validation
    if (!email || !currentPassword || !newPassword || !userId) {
      console.log('Missing required fields:', { 
        hasEmail: !!email, 
        hasCurrentPassword: !!currentPassword, 
        hasNewPassword: !!newPassword, 
        hasUserId: !!userId 
      });
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if the user exists and verify it's the correct user
    const userQuery = await db.query(
      'SELECT * FROM userRegistration WHERE email = $1 AND user_id = $2',
      [email, userId]
    );
    
    if (userQuery.rows.length === 0) {
      console.log('User not found for:', { email, userId });
      return res.status(400).json({ error: 'User not found or unauthorized' });
    }

    const user = userQuery.rows[0];

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      console.log('Invalid current password for user:', { email, userId });
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update the password and password_change timestamp in the database
    const now = new Date().toISOString();
    const updateResult = await db.query(
      'UPDATE userRegistration SET password = $1, password_change = $2 WHERE user_id = $3 RETURNING password_change',
      [hashedNewPassword, now, userId]
    );

    // Log the activity
    await logActivity(
      userId,
      'PASSWORD_CHANGE',
      'Password changed successfully',
      null,
      null,
      req
    );

    console.log('Password changed successfully for user:', { email, userId });
    res.status(200).json({ 
      message: 'Password changed successfully',
      passwordChangeDate: updateResult.rows[0].password_change
    });
  } catch (err) {
    console.error('Password change error:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Change vault key route
router.post('/vaults/:vaultId/change-key', async (req, res) => {
  const { vaultId } = req.params;
  const { currentKey, newKey, userId } = req.body;

  try {
    // Input validation
    if (!currentKey || !newKey || !userId) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Get vault details
    const vaultQuery = await db.query(
      'SELECT * FROM vaultTable WHERE vault_id = $1',
      [vaultId]
    );

    if (vaultQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Vault not found' });
    }

    const vault = vaultQuery.rows[0];

    // Verify user ownership
    if (vault.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Verify current vault key
    const isKeyValid = await bcrypt.compare(currentKey, vault.vault_key);
    if (!isKeyValid) {
      return res.status(401).json({ error: 'Current vault key is incorrect' });
    }

    // Start a transaction for updating vault key and re-encrypting files
    await db.query('BEGIN');

    try {
      // Hash the new vault key
      const saltRounds = 10;
      const hashedNewKey = await bcrypt.hash(newKey, saltRounds);

      // Update the vault key in the database
      await db.query(
        'UPDATE vaultTable SET vault_key = $1 WHERE vault_id = $2',
        [hashedNewKey, vaultId]
      );

      // Get all files encrypted with vault key
      const filesQuery = await db.query(
        `SELECT f.*, k.key_id, k.hashed_key 
         FROM fileTable f 
         JOIN fileEncryptionKeys k ON f.file_id = k.file_id 
         WHERE f.vault_id = $1 AND f.encryption_type = 'vault'`,
        [vaultId]
      );

      // Re-encrypt each file with the new vault key
      for (const file of filesQuery.rows) {
        try {
          // Read the encrypted file
          const encryptedData = fs.readFileSync(file.file_path, 'hex');
          
          // Decrypt with old key
          const decryptedData = decryptFile(encryptedData, currentKey, file.iv);
          
          // Re-encrypt with new key
          const { iv: newIv, encryptedData: newEncryptedData } = encryptFile(decryptedData, newKey);
          
          // Save the re-encrypted file
          fs.writeFileSync(file.file_path, newEncryptedData, 'hex');
          
          // Update the IV in fileTable
          await db.query(
            'UPDATE fileTable SET iv = $1 WHERE file_id = $2',
            [newIv, file.file_id]
          );
          
          // Update the hashed key in fileEncryptionKeys
          const hashedFileKey = await hashEncryptionKey(newKey);
          await db.query(
            'UPDATE fileEncryptionKeys SET hashed_key = $1 WHERE key_id = $2',
            [hashedFileKey, file.key_id]
          );
        } catch (encryptError) {
          console.error(`Error re-encrypting file ${file.file_name}:`, encryptError);
          throw new Error(`Failed to re-encrypt file ${file.file_name}`);
        }
      }

      // Log the vault key change
      await logActivity(
        userId,
        'VAULT_KEY_CHANGE',
        `Changed encryption key for vault: ${vault.vault_name}`,
        vaultId,
        null,
        req
      );

      // Commit the transaction
      await db.query('COMMIT');

      res.status(200).json({ 
        message: 'Vault key changed successfully'
      });
    } catch (err) {
      // Rollback the transaction on error
      await db.query('ROLLBACK');
      throw err;
    }
  } catch (err) {
    console.error('Vault key change error:', err);
    res.status(500).json({ 
      error: 'Failed to change vault key', 
      details: err.message 
    });
  }
});

// Get files for a user
router.get('/files/user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    // Check if the user exists
    const userQuery = await db.query('SELECT * FROM userRegistration WHERE user_id = $1', [userId]);
    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all files for the user across all vaults
    const filesQuery = await db.query(
      `SELECT 
        f.file_id as "fileId",
        f.file_name as "fileName",
        f.file_type as "fileType",
        f.file_size as "fileSize",
        f.encryption_type as "encryptionType",
        f.created_at as "createdAt",
        v.vault_name as "vaultName"
      FROM fileTable f
      JOIN vaultTable v ON f.vault_id = v.vault_id
      WHERE v.user_id = $1
      ORDER BY f.created_at DESC`,
      [userId]
    );

    res.json({ files: filesQuery.rows });
  } catch (err) {
    console.error('Error fetching user files:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change file encryption key
router.post('/files/:fileId/change-key', async (req, res) => {
  const { fileId } = req.params;
  const { currentKey, newKey, userId } = req.body;

  console.log('Starting file key change process:', { fileId });

  try {
    // Input validation with detailed error messages
    if (!currentKey) {
      return res.status(400).json({ error: 'Current key is required' });
    }
    if (!newKey) {
      return res.status(400).json({ error: 'New key is required' });
    }
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get file details and verify ownership
    const fileQuery = await db.query(
      `SELECT 
        f.*,
        k.key_id,
        k.hashed_key,
        v.user_id,
        v.vault_name,
        v.vault_key
      FROM fileTable f 
      JOIN fileEncryptionKeys k ON f.file_id = k.file_id 
      JOIN vaultTable v ON f.vault_id = v.vault_id 
      WHERE f.file_id = $1`,
      [fileId]
    );

    if (fileQuery.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileQuery.rows[0];
    console.log('File found:', { fileName: file.file_name, encryptionType: file.encryption_type });

    // Verify user ownership
    if (file.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Verify current key based on encryption type
    let isKeyValid = false;
    let decryptionKey = currentKey;

    try {
      if (file.encryption_type === 'vault') {
        // For vault-encrypted files, verify against vault key
        isKeyValid = await bcrypt.compare(currentKey, file.vault_key);
        if (!isKeyValid) {
          return res.status(401).json({ error: 'Current vault key is incorrect' });
        }
        // Use the actual vault key for decryption
        decryptionKey = currentKey;
      } else {
        // For custom-encrypted files, verify against file's hashed key
        isKeyValid = await verifyEncryptionKey(currentKey, file.hashed_key);
        if (!isKeyValid) {
          return res.status(401).json({ error: 'Current encryption key is incorrect' });
        }
        decryptionKey = currentKey;
      }
    } catch (verifyError) {
      console.error('Key verification error:', verifyError);
      return res.status(400).json({ error: 'Failed to verify encryption key' });
    }

    // Start transaction
    await db.query('BEGIN');

    try {
      // Check if file exists on disk
      if (!fs.existsSync(file.file_path)) {
        throw new Error('Encrypted file not found on disk');
      }

      // Read and decrypt file
      const encryptedData = fs.readFileSync(file.file_path, 'hex');
      let decryptedData;
      try {
        console.log('Attempting decryption with key type:', file.encryption_type);
        decryptedData = decryptFile(encryptedData, decryptionKey, file.iv);
        if (!decryptedData) {
          throw new Error('Decryption resulted in null or undefined data');
        }
      } catch (decryptError) {
        console.error('Decryption error:', decryptError);
        throw new Error('Failed to decrypt file with current key');
      }

      // Re-encrypt with new key
      let newIv, newEncryptedData;
      try {
        const result = encryptFile(Buffer.from(decryptedData), newKey);
        newIv = result.iv;
        newEncryptedData = result.encryptedData;
        if (!newEncryptedData || !newIv) {
          throw new Error('Encryption resulted in invalid data');
        }
      } catch (encryptError) {
        console.error('Encryption error:', encryptError);
        throw new Error('Failed to re-encrypt file with new key');
      }

      // Save re-encrypted file
      try {
        fs.writeFileSync(file.file_path, newEncryptedData, 'hex');
      } catch (writeError) {
        console.error('File write error:', writeError);
        throw new Error('Failed to save re-encrypted file');
      }

      // Update database records
      try {
        // Update file table
        await db.query(
          'UPDATE fileTable SET iv = $1, encryption_type = $2 WHERE file_id = $3',
          [newIv, 'custom', fileId]
        );

        // Update encryption keys
        const hashedNewKey = await hashEncryptionKey(newKey);
        await db.query(
          'UPDATE fileEncryptionKeys SET hashed_key = $1 WHERE key_id = $2',
          [hashedNewKey, file.key_id]
        );
      } catch (dbError) {
        console.error('Database update error:', dbError);
        throw new Error('Failed to update database records');
      }

      // Log activity
      await logActivity(
        userId,
        'FILE_KEY_CHANGE',
        `Changed encryption key for file: ${file.file_name} in vault: ${file.vault_name}`,
        file.vault_id,
        fileId,
        req
      );

      // Commit transaction
      await db.query('COMMIT');

      console.log('File key change completed successfully');
      res.json({ 
        message: 'File encryption key changed successfully',
        file: {
          fileId: file.file_id,
          fileName: file.file_name,
          encryptionType: 'custom'
        }
      });
    } catch (error) {
      console.error('Transaction error:', error);
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (err) {
    console.error('File key change error:', err);
    // Ensure transaction is rolled back
    try {
      await db.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback error:', rollbackErr);
    }
    res.status(500).json({ 
      error: 'Failed to change file encryption key',
      details: err.message
    });
  }
});

// Activity log routes
router.get('/activities/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const result = await getActivities(userId, page, limit);
        res.json(result);
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ error: 'Failed to fetch activities' });
    }
});

// route for logging activities
router.post('/activities', async (req, res) => {
    try {
        const { userId, actionType, details, vaultId, fileId } = req.body;
        const result = await logActivity(userId, actionType, details, vaultId, fileId, req);
        res.json(result);
    } catch (error) {
        console.error('Error logging activity:', error);
        res.status(500).json({ error: 'Failed to log activity' });
    }
});

// route for searching activities
router.post('/activities/search/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { searchTerm, filters } = req.body;

        const result = await searchActivities(userId, searchTerm, filters);
        res.json(result);
    } catch (error) {
        console.error('Error searching activities:', error);
        res.status(500).json({ error: 'Failed to search activities' });
    }
});

export default router; 