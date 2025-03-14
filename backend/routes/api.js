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
import { supabase, serviceClient } from '../supabaseClient.js';
import crypto from 'crypto';



const router = express.Router();

// A buckets cache to track which user vaults map to which buckets
const bucketMap = new Map();

// Function to get or create a bucket reference for a user's vault
const getOrCreateBucketReference = async (userId, vaultName) => {

  const bucketName = 'securefiles';
  
  try {
    // Check if the standard bucket exists
    const { data: bucketInfo, error: checkError } = await supabase
      .storage
      .getBucket(bucketName);
      
    if (!bucketInfo) {
      console.log(`Common bucket '${bucketName}' doesn't exist yet. This is normal on first run.`);
      // We won't try to create it here - the bucket should be created via Supabase dashboard
      // by the administrator with appropriate policies
      
      // Check if the bucket actually exists (case sensitive check)
      const { data: buckets, error: listError } = await supabase
        .storage
        .listBuckets();
        
      if (listError) {
        console.error('Error listing buckets:', listError);
      } else {
        console.log('Available buckets:', buckets.map(b => b.name));
        // Check if our bucket exists but with different case
        const matchingBucket = buckets.find(b => 
          b.name.toLowerCase() === bucketName.toLowerCase());
          
        if (matchingBucket && matchingBucket.name !== bucketName) {
          console.log(`Found bucket with different case: '${matchingBucket.name}'. Using this instead.`);
          return { bucketName: matchingBucket.name, folderPath };
        }
      }
    }
    
    // Generate a folder path for this user's vault within the shared bucket
    // This ensures user data is logically separated even in a shared bucket
    const folderPath = `${userId}/${vaultName.toLowerCase().replace(/\s+/g, '_')}`;
    
    // Store in our local map
    bucketMap.set(`${userId}_${vaultName}`, { 
      bucketName,
      folderPath
    });
    
    return { bucketName, folderPath };
  } catch (error) {
    console.error('Error in bucket reference creation:', error);
    throw error;
  }
};

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
    // Validate first name
    body('first_name')
      .notEmpty()
      .withMessage('First name is required'),
    
    // Validate last name
    body('last_name')
      .notEmpty()
      .withMessage('Last name is required'),
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
    
    
    const { email, password, first_name, last_name } = req.body;

    try {
      // 1. Creating auth user with metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email:email,
        password:password,
        options:{
          emailRedirectTo: 'http://localhost:5001/auth/callback',
          data:{
            first_name:first_name,
            last_name:last_name
          }
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        throw authError;
      }

      // fetch user data from supabase profiles table
      const { data: userData, error: fetchError } = await supabase
        .from('profiles')
        .select(`
          first_name,
          last_name
        `)
        .eq('id', authData.user.id)
        .single();

      if (fetchError) throw fetchError;

      // using auth table data directly
      if (!authData || !authData.user) {
        throw new Error('Failed to create user');
      }

      // Return the user data from the auth response
      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: authData.user.id,
          email: authData.user.email,
          first_name: userData.first_name,
          last_name: userData.last_name
        }
      });
    } catch (err) {
      console.error('Signup error:', err);
      res.status(500).json({
        error: 'Registration failed',
        details: err.message
      });
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

    // Supabase authentication for signin
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (signInError) {
      console.error('Signin error:', signInError);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // If signin successful, fetch user profile data
    const { data: userData, error: fetchError } = await supabase
      .from('profiles')
      .select(`
        first_name,
        last_name
      `)
      .eq('id', authData.user.id)
      .single();

    if (fetchError) {
      console.error('Error fetching user profile:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch user profile', details: fetchError.message });
    }

      console.log('Login successful, returning user data');

    // Log detailed user information for debugging
    console.log('User details:', {
      id: authData.user.id,
      email: authData.user.email,
      firstName: userData.first_name,
      lastName: userData.last_name,
      fullName: `${userData.first_name} ${userData.last_name}`,
      lastSignIn: authData.user.last_sign_in_at
    });

    // Return a success response with user data from Supabase
      res.status(200).json({
        message: 'Signin successful!',
        user: {
        userId: authData.user.id,
        fullname: `${userData.first_name} ${userData.last_name}`,
        email: authData.user.email,
        firstName: userData.first_name,
        lastName: userData.last_name,
        lastLogin: authData.user.last_sign_in_at || null
      }
    });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});
// resend verification email route
router.post('/auth/resend-verification', async (req, res) => {
  const { email } = req.body;
  
  try {
    // Input validation
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Use Supabase to resend verification email
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    });

    if (error) {
      console.error('Resend verification error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ message: 'Verification email resent successfully' });
  } catch (err) {
    console.error('Resend verification error:', err);
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
      // Check if the user exists in Supabase
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user_id)
        .single();

      if (userError || !userData) {
        console.error('User verification error:', userError);
        return res.status(400).json({ error: 'User does not exist' });
      }

      // Get or create bucket reference
      const { bucketName, folderPath } = await getOrCreateBucketReference(user_id, vault_name);

      // Hash the vault key
      const saltRounds = 10;
      const hashedVaultKey = await bcrypt.hash(vault_key, saltRounds);

      // Insert new vault into Supabase with bucket reference and folder path
      const { data: newVault, error: vaultError } = await supabase
        .from('vaults')
        .insert({
          vault_name: vault_name,
          vault_key: hashedVaultKey,
          user_id: user_id,
          storage_bucket: bucketName,
          storage_path: folderPath  // Store the folder path within the bucket
        })
        .select()
        .single();

      if (vaultError) {
        console.error('Vault creation error:', vaultError);
        return res.status(500).json({ error: 'Failed to create vault', details: vaultError.message });
      }

      // Log the activity
      await logActivity(
        user_id,
        'VAULT_CREATE',
        `Created new vault: ${vault_name}`,
        newVault.vault_id,
        null,
        req
      );

      // Send a success response
      res.status(201).json({
        message: 'Vault created successfully!',
        vault: {
          vaultId: newVault.vault_id,
          vaultName: newVault.vault_name,
          userId: newVault.user_id,
          createdAt: newVault.created_at,
          storageBucket: bucketName,
          storagePath: folderPath
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
    // Validate the userId
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Check if the user exists in Supabase
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('User verification error:', userError);
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all vaults for the user from Supabase
    const { data: vaults, error: vaultsError } = await supabase
      .from('vaults')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (vaultsError) {
      console.error('Error fetching vaults:', vaultsError);
      return res.status(500).json({ error: 'Failed to fetch vaults', details: vaultsError.message });
    }

    
    // Format the response based on available data
    const formattedVaults = vaults.map(vault => ({
      id: vault.vault_id,
      name: vault.vault_name,
      createdAt: new Date(vault.created_at).toLocaleString(),
      // If you don't have file info yet, provide defaults
      filesCount: 0,
      totalSize: 0,
      lastAccessed: 'Never',
    }));

    // Send the response
    if (formattedVaults.length === 0) {
      return res.status(200).json({ message: 'No vaults found for this user', vaults: [] });
    }

    res.status(200).json({ vaults: formattedVaults });
  } catch (err) {
    console.error('Error fetching vaults:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Delete vault route
router.delete('/vaults/:vaultId', async (req, res) => {
  const { vaultId } = req.params;
  const { userId } = req.body;

  try {
    // First check if the vault exists
    const { data: vault, error: vaultError } = await supabase
      .from('vaults')
      .select('vault_name, storage_bucket, storage_path')
      .eq('vault_id', vaultId)
      .eq('user_id', userId)
      .single();
    
    if (vaultError || !vault) {
      console.error('Vault check error:', vaultError);
      return res.status(404).json({ error: 'Vault not found or unauthorized' });
    }

    // Log the activity before deletion
    await logActivity(
      userId,
      'VAULT_DELETE',
      `Deleted vault: ${vault.vault_name}`,
      vaultId,
      null,
      req
    );

    // Delete all files in the storage folder (not the bucket)
    if (vault.storage_bucket && vault.storage_path) {
      // List all files in the vault's folder
      const { data: fileList, error: listError } = await supabase
        .storage
        .from(vault.storage_bucket)
        .list(vault.storage_path);
        
      if (!listError && fileList && fileList.length > 0) {
        const filesToDelete = fileList.map(file => `${vault.storage_path}/${file.name}`);
        
        // Delete all files in the folder
        const { error: deleteFilesError } = await supabase
          .storage
          .from(vault.storage_bucket)
          .remove(filesToDelete);
          
        if (deleteFilesError) {
          console.error('Error deleting files from storage:', deleteFilesError);
          // Continue anyway, as we still want to try deleting the vault
        }
      }
      
      // Note: We don't delete the bucket anymore since it's shared
    }

    // Delete all associated files records (the cascade will handle file_encryption_keys)
    const { error: deleteFilesError } = await supabase
      .from('files')
      .delete()
      .eq('vault_id', vaultId);
      
    if (deleteFilesError) {
      console.error('Error deleting file records:', deleteFilesError);
    }

    // Delete the vault
    const { error: deleteError } = await supabase
      .from('vaults')
      .delete()
      .eq('vault_id', vaultId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Vault deletion error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete vault', details: deleteError.message });
    }

    res.json({ message: 'Vault deleted successfully' });
  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Vault verification/access route
router.post('/vaults/:vaultId/verify', async (req, res) => {
  const { vaultId } = req.params;
  const { vault_key, email, password } = req.body;

  try {
    // Get the vault details from Supabase
    const { data: vaultData, error: vaultError } = await supabase
      .from('vaults')
      .select('vault_key, user_id, vault_name')
      .eq('vault_id', vaultId)
      .single();
    
    if (vaultError || !vaultData) {
      console.error('Vault retrieval error:', vaultError);
      return res.status(404).json({ error: 'Vault not found' });
    }

    // If email and password are provided, verify user credentials with Supabase Auth
    if (email && password) {
      // Sign in with Supabase to verify credentials
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (authError) {
        console.error('Authentication error:', authError);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if the authenticated user is the vault owner
      if (authData.user.id !== vaultData.user_id) {
        return res.status(403).json({ error: 'User does not own this vault' });
      }

      // Log vault access via user credentials
      await logActivity(
        vaultData.user_id,
        'VAULT_ACCESS',
        `Accessed vault: ${vaultData.vault_name} via user credentials`,
        vaultId,
        null,
        req
      );

      return res.json({ 
        message: 'Access granted via user verification',
        vault: {
          id: vaultId,
          name: vaultData.vault_name,
          vault_key: vault_key
        }
      });
    }

    // Verify vault key
    const isKeyValid = await bcrypt.compare(vault_key, vaultData.vault_key);
    if (!isKeyValid) {
      return res.status(401).json({ error: 'Invalid vault key' });
    }

    // Log vault access via vault key
    await logActivity(
      vaultData.user_id,
      'VAULT_ACCESS',
      `Accessed vault: ${vaultData.vault_name} via vault key`,
      vaultId,
      null,
      req
    );

    res.json({ 
      message: 'Vault key verified successfully',
      vault: {
        id: vaultId,
        name: vaultData.vault_name,
        vault_key: vault_key
      }
    });
  } catch (err) {
    console.error('Vault key verification error:', err.message);
    res.status(500).json({ error: 'Server error', details: err.message });
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

    // Get vault details from Supabase, including the storage bucket name and path
    const { data: vault, error: vaultError } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vault_id)
      .eq('user_id', user_id)
      .single();
    
    if (vaultError || !vault) {
      console.error('Vault check error:', vaultError);
      throw new Error('Vault not found or unauthorized access');
    }

    // If using vault key, verify that the provided key matches the vault key
    if (use_vault_key) {
      const isVaultKeyValid = await bcrypt.compare(encryption_key, vault.vault_key);
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
      
      // Generate a file UUID
      const fileId = crypto.randomUUID();
      
      // Generate a key UUID
      const keyId = crypto.randomUUID();
      
      // Create file path in Supabase Storage - now with folder path
      const encryptedFilename = `${vault.storage_path}/${fileId}${path.extname(file.originalname)}`;
      
      // Make sure the folder exists by creating it if needed
      try {
        console.log('Checking if folder exists:', vault.storage_path);
        
        // Use service client if available, otherwise fall back to regular client
        const storageClient = serviceClient || supabase;
        
        // Try to list files in the path to see if it exists
        const { data: folderCheck, error: folderCheckError } = await storageClient
          .storage
          .from(vault.storage_bucket)
          .list(vault.storage_path);
          
        if (folderCheckError) {
          console.log('Folder may not exist, attempting to create folder structure:', vault.storage_path);
          
          // Create an empty file to establish the folder path
          const emptyBuffer = Buffer.from('');
          const folderMarker = `${vault.storage_path}/.folder`;
          
          const { error: folderCreateError } = await storageClient
            .storage
            .from(vault.storage_bucket)
            .upload(folderMarker, emptyBuffer);
            
          if (folderCreateError) {
            console.error('Error creating folder structure:', folderCreateError);
          } else {
            console.log('Created folder structure successfully');
          }
        }
      } catch (folderError) {
        console.error('Error checking/creating folder:', folderError);
        // Continue anyway, the upload might still succeed
      }
      
      console.log('Uploading encrypted file to storage:', {
        bucket: vault.storage_bucket,
        path: encryptedFilename,
        usingServiceClient: !!serviceClient
      });
      
      // Upload encrypted file to Supabase Storage
      const storageClient = serviceClient || supabase;
      const { error: uploadError } = await storageClient
        .storage
        .from(vault.storage_bucket)
        .upload(encryptedFilename, Buffer.from(encryptedData, 'hex'), {
          contentType: 'application/octet-stream', // Use generic type for encrypted data
          cacheControl: 'private, max-age=0', // No caching for secure files
        });
        
      if (uploadError) {
        console.error('File upload to Supabase Storage failed:', uploadError);
        console.error('Error details:', {
          bucket: vault.storage_bucket,
          path: encryptedFilename,
          message: uploadError.message,
          code: uploadError.code,
          statusCode: uploadError.statusCode,
          details: uploadError.details,
          usingServiceClient: !!serviceClient
        });
        throw new Error('Failed to upload encrypted file to storage: ' + uploadError.message);
      }
      
      // Get the file URL (will be needed for retrieval)
      const { data: fileUrlData } = await storageClient
        .storage
        .from(vault.storage_bucket)
        .getPublicUrl(encryptedFilename);
        
      const filePath = fileUrlData?.publicUrl || '';
      
      // Store file details in database
      const { data: fileData, error: fileInsertError } = await supabase
        .from('files')
        .insert({
          file_id: fileId,
          file_name: file.originalname,
          file_type: path.extname(file.originalname).slice(1),
          file_size: file.size,
          vault_id: vault_id,
          file_path: filePath,
          iv: iv,
          encryption_type: use_vault_key ? 'vault' : 'custom',
          storage_path: encryptedFilename,
          storage_bucket: vault.storage_bucket
        })
        .select()
        .single();
        
      if (fileInsertError) {
        console.error('Error inserting file record:', fileInsertError);
        throw new Error('Failed to record file in database');
      }

      // Store encryption key
      const hashedKey = await hashEncryptionKey(encryption_key);
      const { error: keyInsertError } = await supabase
        .from('file_encryption_keys')
        .insert({
          key_id: keyId,
          file_id: fileId,
          hashed_key: hashedKey
        });
        
      if (keyInsertError) {
        console.error('Error inserting encryption key:', keyInsertError);
        throw new Error('Failed to store encryption key');
      }

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
    console.error('Error stack:', error.stack);
    
    // Check if it's a Supabase error with more details
    if (error.statusCode || error.code) {
      console.error('Supabase error details:', {
        code: error.code,
        statusCode: error.statusCode,
        message: error.message,
        details: error.details || 'No additional details'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to upload file',
      details: error.message
    });
  }
});

// file decrypt route
router.post('/file/decrypt', async (req, res) => {
  const { file_id, decryption_key, user_id } = req.body;

  try {
    // Validate user_id
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get file and encryption details from Supabase
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select(`
        *,
        vaults:vault_id(vault_name),
        encryption_keys:file_id(hashed_key)
      `)
      .eq('file_id', file_id)
      .single();

    if (fileError || !file) {
      console.error('File retrieval error:', fileError);
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Ensure the user has permission to access this file
    const { data: vaultAccess, error: accessError } = await supabase
      .from('vaults')
      .select('vault_id')
      .eq('vault_id', file.vault_id)
      .eq('user_id', user_id)
      .single();
      
    if (accessError || !vaultAccess) {
      console.error('Access check error:', accessError);
      return res.status(403).json({ error: 'You do not have permission to access this file' });
    }

    // Download the encrypted file from Supabase Storage
    const { data: encryptedFileData, error: downloadError } = await supabase
      .storage
      .from(file.storage_bucket)
      .download(file.storage_path);

    if (downloadError || !encryptedFileData) {
      console.error('Error downloading encrypted file:', downloadError);
      return res.status(500).json({ error: 'Failed to retrieve encrypted file' });
    }

    // Convert Blob to hex string for decryption
    const encryptedDataHex = await blobToHexString(encryptedFileData);
    
    try {
      // Decrypt the file
      const decryptedData = decryptFile(encryptedDataHex, decryption_key, file.iv);
      
      // Log successful decryption
      await logActivity(
        user_id,
        'FILE_DECRYPT',
        `Decrypted file: ${file.file_name} from vault: ${file.vaults.vault_name}`,
        file.vault_id,
        file_id,
        req
      );
      
      // For text files, convert to UTF-8 string
      if (file.file_type.toLowerCase() === 'txt') {
        const textContent = decryptedData.toString('utf-8');
        return res.json({ content: textContent });
      }

      // For other files
      const contentType = getContentType(file.file_type);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${file.file_name}"`);
      
      // Send the decrypted file
      return res.send(Buffer.from(decryptedData));
    } catch (decryptError) {
      console.error('Decryption failed:', decryptError);
      return res.status(400).json({ error: 'Invalid decryption key' });
    }
  } catch (err) {
    console.error('File decryption error:', err);
    res.status(500).json({ error: 'Failed to decrypt file' });
  }
});

// Helper function to determine the correct content type for files
function getContentType(fileType) {
  // Standardize fileType by removing any dots and converting to lowercase
  const type = fileType.toLowerCase().replace(/^\./, '');
  
  // Common MIME types mapping
  const mimeTypes = {
    // Text formats
    'txt': 'text/plain',
    'html': 'text/html',
    'css': 'text/css',
    'csv': 'text/csv',
    
    // Image formats
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    
    // Document formats
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    
    // Archive formats
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    
    // Audio formats
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    
    // Video formats
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'avi': 'video/x-msvideo',
    
    // Other common formats
    'json': 'application/json',
    'xml': 'application/xml',
    'js': 'application/javascript',
  };
  
  // Return the appropriate MIME type or a default type if not found
  return mimeTypes[type] || 'application/octet-stream';
}

// Helper function to convert Blob to hex string
async function blobToHexString(blob) {
  const buffer = await blob.arrayBuffer();
  return Buffer.from(buffer).toString('hex');
}

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

// files fetch route
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
    console.error('File decryption error:', err);
    res.status(500).json({ error: 'Failed to decrypt file' });
  }
});

// Diagnostic route for checking storage access
router.get('/diagnostics/storage', async (req, res) => {
  try {
    // Get available buckets
    const { data: buckets, error: bucketError } = await supabase
      .storage
      .listBuckets();
      
    if (bucketError) {
      return res.status(500).json({
        error: 'Failed to list buckets',
        details: bucketError
      });
    }
    
    // Check each bucket for permissions
    const bucketDetails = await Promise.all(
      buckets.map(async (bucket) => {
        try {
          // Try to list files in bucket root
          const { data: files, error: listError } = await supabase
            .storage
            .from(bucket.name)
            .list();
            
          return {
            name: bucket.name,
            id: bucket.id,
            public: bucket.public,
            canList: !listError,
            listError: listError ? listError.message : null,
            fileCount: files ? files.length : null
          };
        } catch (err) {
          return {
            name: bucket.name,
            id: bucket.id,
            public: bucket.public,
            error: err.message
          };
        }
      })
    );
    
    res.json({
      status: 'success',
      buckets: bucketDetails
    });
  } catch (err) {
    console.error('Storage diagnostics error:', err);
    res.status(500).json({
      error: 'Diagnostics failed',
      details: err.message
    });
  }
});

// Test route for Supabase storage permissions
router.get('/test-storage-upload', async (req, res) => {
  try {
    const testContent = Buffer.from('This is a test file');
    const testPath = 'test-upload.txt';
    
    // First try with regular client
    try {
      const { data: regularData, error: regularError } = await supabase
        .storage
        .from('securefiles')
        .upload(testPath, testContent, { upsert: true });
        
      if (regularError) {
        console.log('Regular client upload failed:', regularError);
      } else {
        console.log('Regular client upload succeeded:', regularData);
        
        // Clean up
        await supabase.storage.from('securefiles').remove([testPath]);
        return res.json({ success: true, client: 'regular' });
      }
    } catch (err) {
      console.error('Regular client error:', err);
    }
    
    // Test with service role if available
    if (serviceClient) {
      try {
        const { data: serviceData, error: serviceError } = await serviceClient
          .storage
          .from('securefiles')
          .upload(testPath, testContent, { upsert: true });
          
        if (serviceError) {
          console.log('Service client upload failed:', serviceError);
          return res.status(500).json({
            success: false,
            error: serviceError,
            message: 'Both regular and service client uploads failed'
          });
        } else {
          console.log('Service client upload succeeded:', serviceData);
          
          // Clean up
          await serviceClient.storage.from('securefiles').remove([testPath]);
          return res.json({ success: true, client: 'service' });
        }
      } catch (err) {
        console.error('Service client error:', err);
        return res.status(500).json({
          success: false,
          error: err.message,
          message: 'Both clients failed with errors'
        });
      }
    } else {
      return res.status(500).json({
        success: false,
        message: 'No service client available - make sure SUPABASE_SERVICE_ROLE_KEY is set in .env'
      });
    }
  } catch (err) {
    console.error('Test upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Export the router
export default router; 