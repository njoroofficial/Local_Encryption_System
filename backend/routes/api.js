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
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname } from 'path';



const router = express.Router();

// A buckets cache to track which user vaults map to which buckets
const bucketMap = new Map();

// Function to get or create a bucket reference for a user's vault
const getOrCreateBucketReference = async (userId, vaultName) => {

  const bucketName = 'securefiles';
  
  try {
    // Check if the common bucket exists
    const { data: bucketInfo, error: checkError } = await supabase
      .storage
      .getBucket(bucketName);
      
    if (!bucketInfo) {
      console.log(`Common bucket '${bucketName}' doesn't exist yet. This is normal on first run.`);
      
      
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
          emailRedirectTo: 'http://localhost:5000/auth/callback',
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
        // check if the user id is the same as the auth user id
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
      // check if the user id is the same as the auth user id
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
          storage_path: folderPath,  // Store the folder path within the bucket
          files_count: 0,  // Initialize files count to 0
          last_accessed: new Date().toISOString()  // Set initial access time
        })
        // select the new vault
        .select()
        // return the new vault
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

    // Get actual file counts for each vault by querying the files table
    const formattedVaults = await Promise.all(vaults.map(async (vault) => {
      // Query files table to get actual count
      const { count, error: countError } = await supabase
        .from('files')
        .select('*', { count: 'exact', head: true })
        .eq('vault_id', vault.vault_id);
      
      if (countError) {
        console.error('Error counting files for vault:', vault.vault_id, countError);
      }
      
      // Use the actual count if available, fallback to stored count
      const filesCount = count !== null ? count : (vault.files_count || 0);
      
      // Update the stored count if it's different from the actual count
      if (filesCount !== vault.files_count) {
        const { error: updateError } = await supabase
          .from('vaults')
          .update({ files_count: filesCount })
          .eq('vault_id', vault.vault_id);
          
        if (updateError) {
          console.error('Error updating vault file count:', updateError);
        }
      }
      
      return {
        id: vault.vault_id,
        name: vault.vault_name,
        createdAt: new Date(vault.created_at).toLocaleString(),
        filesCount: filesCount,
        lastAccessed: vault.last_accessed ? new Date(vault.last_accessed).toLocaleString() : 'Never',
      };
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

// Verify vault key before deletion
router.post('/vault/verify-delete', async (req, res) => {
  const { vault_id, vault_key, user_id } = req.body;

  try {
    // Validate inputs
    if (!vault_id || !vault_key || !user_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get vault details from Supabase
    const { data: vault, error: vaultError } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vault_id)
      .eq('user_id', user_id)
      .single();

    if (vaultError || !vault) {
      console.error('Vault retrieval error:', vaultError);
      return res.status(404).json({ error: 'Vault not found or unauthorized access' });
    }

    // Verify the vault key
    const isKeyValid = await bcrypt.compare(vault_key, vault.vault_key);
    
    if (!isKeyValid) {
      return res.status(401).json({ error: 'Invalid vault key' });
    }

    // Get file count in the vault
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('file_id')
      .eq('vault_id', vault_id);
      
    const fileCount = files ? files.length : 0;

    // Log the verification attempt
    try {
      await logActivity(
        user_id,
        'VAULT_DELETE_VERIFY',
        `Verified vault key for deletion: ${vault.vault_name}`,
        vault_id,
        null,
        req
      );
    } catch (logError) {
      console.error('Error logging verification activity:', logError);
      // Continue even if logging fails
    }

    // Return success with vault details
    res.json({
      message: 'Vault key verified successfully',
      vault: {
        vault_id: vault.vault_id,
        vault_name: vault.vault_name,
        fileCount: fileCount
      }
    });
  } catch (err) {
    console.error('Vault verification error:', err);
    res.status(500).json({ error: 'Failed to verify vault key' });
  }
});

// Delete vault route
router.delete('/vaults/:vaultId', async (req, res) => {
  const { vaultId } = req.params;
  const userId = req.body.userId || req.body.user_id;

  // Add detailed logging
  console.log('Delete vault request received:', {
    vaultId,
    userId,
    body: req.body,
    hasUserId: !!userId,
    requestHeaders: req.headers
  });

  try {
    // Validate userId
    if (!userId) {
      console.error('Missing userId in delete vault request');
      return res.status(400).json({ error: 'User ID is required' });
    }

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
      // Use the service client if available for better permission handling
      const storageClient = serviceClient || supabase;
      
      // First approach: List all files recursively and delete them
      const deleteFilesRecursively = async (path) => {
        console.log(`Listing files in: ${path}`);
        
        // List all items (files and folders) at the current path
        const { data: items, error: listError } = await storageClient
          .storage
          .from(vault.storage_bucket)
          .list(path, { sortBy: { column: 'name', order: 'asc' } });
          
        if (listError) {
          console.error(`Error listing items in ${path}:`, listError);
          return;
        }
        
        if (items && items.length > 0) {
          // Files in the current directory
          const files = items.filter(item => !item.id.endsWith('/')).map(item => `${path}/${item.name}`);
          
          // Process files
          if (files.length > 0) {
            console.log(`Deleting ${files.length} files from ${path}`);
            const { error: deleteFilesError } = await storageClient
              .storage
              .from(vault.storage_bucket)
              .remove(files);
              
            if (deleteFilesError) {
              console.error(`Error deleting files from ${path}:`, deleteFilesError);
            }
          }
          
          // Process folders recursively
          const folders = items.filter(item => item.id.endsWith('/'));
          for (const folder of folders) {
            await deleteFilesRecursively(`${path}/${folder.name}`);
          }
        }
      };
      
      // Delete everything in the vault's folder
      await deleteFilesRecursively(vault.storage_path);
      
      // Second approach: Try to delete the folder itself as a fallback
      // Some Supabase storage providers allow deleting folders directly
      try {
        const { error: deleteFolderError } = await storageClient
          .storage
          .from(vault.storage_bucket)
          .remove([vault.storage_path]);
          
        if (deleteFolderError) {
          console.log('Note: Could not delete folder directly (this is normal for some storage providers)');
        } else {
          console.log(`Successfully deleted folder: ${vault.storage_path}`);
        }
      } catch (folderDeleteError) {
        console.log('Note: Folder deletion attempt gave an error (this is expected):', folderDeleteError.message);
      }
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

      // Update the last_accessed time
      const { error: updateError } = await supabase
        .from('vaults')
        .update({ last_accessed: new Date().toISOString() })
        .eq('vault_id', vaultId);

      if (updateError) {
        console.error('Error updating last accessed time:', updateError);
        // Continue anyway
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

    // Update the last_accessed time
    const { error: updateError } = await supabase
      .from('vaults')
      .update({ last_accessed: new Date().toISOString() })
      .eq('vault_id', vaultId);

    if (updateError) {
      console.error('Error updating last accessed time:', updateError);
      // Continue anyway
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

      // Update the vault with file count and last accessed time
      const { count: currentCount, error: countError } = await supabase
        .from('files')
        .select('*', { count: 'exact', head: true })
        .eq('vault_id', vault_id);
        
      if (countError) {
        console.error('Error counting files for vault update:', countError);
      } else {
        // Add 1 because we just added a new file
        const newCount = (currentCount || 0) + 1;
        
        const { error: vaultUpdateError } = await supabase
          .from('vaults')
          .update({ 
            files_count: newCount,
            last_accessed: new Date().toISOString()
          })
          .eq('vault_id', vault_id);

        if (vaultUpdateError) {
          console.error('Error updating vault stats:', vaultUpdateError);
          // Continue anyway as the file was successfully uploaded
        }
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
    const { data: vault, error: vaultError } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .single();
      
    if (vaultError || !vault) {
      return res.status(404).json({ error: 'Vault not found' });
    }

    // Get all files for the vault from Supabase
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('*')
      .eq('vault_id', vaultId)
      .order('created_at', { ascending: false });

    if (filesError) {
      console.error('Error fetching files:', filesError);
      return res.status(500).json({ error: 'Failed to fetch files' });
    }

    // Update the vault's last_accessed timestamp
    const { error: updateError } = await supabase
      .from('vaults')
      .update({ last_accessed: new Date().toISOString() })
      .eq('vault_id', vaultId);

    if (updateError) {
      console.error('Error updating vault last accessed time:', updateError);
      // Continue anyway
    }

    // Format the response to match what the frontend expects
    const formattedFiles = files.map(file => ({
      fileId: file.file_id,
      fileName: file.file_name,
      fileType: file.file_type,
      fileSize: file.file_size,
      filePath: file.file_path,
      createdAt: file.created_at,
      encryption_type: file.encryption_type || 'custom' // Include encryption type
    }));

    // Return empty array if no files found
    res.json({ files: formattedFiles });
  } catch (err) {
    console.error('Error fetching files:', err.message);
    res.status(500).json({ error: 'Server error' });
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
        file_encryption_keys!file_encryption_keys_file_id_fkey(hashed_key),
        vaults(vault_name)
      `)
      .eq('file_id', file_id)
      .single();

    console.log('File retrieval for verification:', {
      fileId: file_id,
      found: !!file,
      hasEncryptionKeys: file && !!file.file_encryption_keys,
      encryptionKeysCount: file?.file_encryption_keys?.length || 0
    });

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

    // Verify the decryption key before attempting to download and decrypt
    // This depends on the type of encryption used
    if (file.encryption_type === 'vault') {
      // For vault-encrypted files, we'll skip verifying against the current vault key
      // This allows users to decrypt files encrypted with previous vault keys
      console.log('File uses vault encryption - will attempt direct decryption with provided key');
      
      // Retrieve the vault name for logging
      const { data: vault, error: vaultError } = await supabase
        .from('vaults')
        .select('vault_name')
        .eq('vault_id', file.vault_id)
        .single();
        
      if (vaultError || !vault) {
        console.error('Vault retrieval error during name lookup:', vaultError);
        // Continue anyway, this is just for logging purposes
      } else {
        console.log(`File belongs to vault: ${vault.vault_name}`);
      }
    } else {
      // For custom-encrypted files, verify against the file's key
      if (!file.file_encryption_keys || file.file_encryption_keys.length === 0) {
        console.error('No encryption key record found for file:', file_id);
        return res.status(404).json({ error: 'Encryption key not found for this file' });
      }
      
      // Verify the key using the stored hash
      const hashedKey = file.file_encryption_keys[0].hashed_key;
      const isKeyValid = await bcrypt.compare(decryption_key, hashedKey);
      
      if (!isKeyValid) {
        console.error('Invalid custom encryption key provided for file decryption');
        return res.status(401).json({ error: 'Invalid decryption key' });
      }
      
      console.log('Custom encryption key verified successfully for file decryption');
    }

    // Download the encrypted file from Supabase Storage - USE SERVICE CLIENT
    const storageClient = serviceClient || supabase; // Use service client if available
    const { data: encryptedFileData, error: downloadError } = await storageClient
      .storage
      .from(file.storage_bucket)
      .download(file.storage_path);

    if (downloadError) {
      console.error('Error downloading encrypted file:', downloadError);
      console.error('File path details:', {
        bucket: file.storage_bucket,
        path: file.storage_path
      });
      
      // Try downloading using the public URL as fallback
      try {
        const { data: urlData } = await supabase
          .storage
          .from(file.storage_bucket)
          .getPublicUrl(file.storage_path);
          
        if (urlData && urlData.publicUrl) {
          const response = await fetch(urlData.publicUrl);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const encryptedDataHex = Buffer.from(arrayBuffer).toString('hex');
          
          // Continue with decryption...
          // ...
        }
      } catch (fallbackError) {
        console.error('Fallback download failed:', fallbackError);
        return res.status(500).json({ error: 'Failed to retrieve encrypted file' });
      }
    }

    // Convert Blob to hex string for decryption
    const encryptedDataHex = await blobToHexString(encryptedFileData);
    
    try {
      // Log IV information for debugging
      console.log('Starting file decryption with:', {
        fileId: file_id,
        fileName: file.file_name,
        ivValue: file.iv,
        ivLength: file.iv?.length,
        encryptionType: file.encryption_type,
        hasIV: !!file.iv,
        encryptedDataLength: encryptedDataHex?.length
      });
      
      // Check if IV is valid format before attempting decryption
      if (!file.iv || typeof file.iv !== 'string' || file.iv.length !== 32) {
        console.error(`Invalid IV format for file ${file_id}:`, {
          iv: file.iv,
          type: typeof file.iv,
          length: file.iv?.length
        });
        
        // Try to update the file's status as needing repair
        try {
          await supabase
            .from('files')
            .update({
              encryption_status: 'needs_repair',
              updated_at: new Date().toISOString()
            })
            .eq('file_id', file_id);
        } catch (repairError) {
          console.error('Failed to mark file for repair:', repairError);
        }
        
        return res.status(400).json({ 
          error: 'File initialization vector (IV) is invalid. The file needs to be re-encrypted.',
          needsRepair: true,
          details: 'Contact support or try re-uploading this file'
        });
      }
      
      // Decrypt the file
      const decryptedData = decryptFile(encryptedDataHex, decryption_key, file.iv);
      
      // Log successful decryption
      await logActivity(
        user_id,
        'FILE_DECRYPT',
        `Decrypted file: ${file.file_name} from vault: ${file.vaults?.vault_name || 'Unknown vault'}`,
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
      console.error('Decryption error details:', {
        message: decryptError.message,
        stack: decryptError.stack,
        fileId: file_id,
        fileIv: file.iv,
        fileType: file.file_type,
        encryptionType: file.encryption_type
      });
      
      let errorMessage = 'Invalid decryption key';
      let errorCode = 'INVALID_KEY';
      let needsRepair = false;
      let vaultKeyChanged = false;
      
      // For vault-encrypted files, check if vault key has been changed recently
      if (file.encryption_type === 'vault' && 
          (decryptError.code === 'ERR_OSSL_BAD_DECRYPT' || 
          (decryptError.message && decryptError.message.includes('bad decrypt')))) {
        // Check if vault was updated more recently than the file
        const { data: vault, error: vaultError } = await supabase
          .from('vaults')
          .select('updated_at')
          .eq('vault_id', file.vault_id)
          .single();
          
        if (!vaultError && vault && vault.updated_at && file.updated_at) {
          const vaultUpdateTime = new Date(vault.updated_at).getTime();
          const fileUpdateTime = new Date(file.updated_at).getTime();
          
          if (vaultUpdateTime > fileUpdateTime) {
            console.log('Vault key was updated after this file was encrypted');
            vaultKeyChanged = true;
            errorMessage = 'This file was encrypted with a previous vault key. Please use the original key that was active when this file was uploaded.';
            errorCode = 'OLD_VAULT_KEY_NEEDED';
          }
        }
      }
      
      if (decryptError.code === 'ERR_OSSL_BAD_DECRYPT' || 
          (decryptError.message && decryptError.message.includes('bad decrypt'))) {
        if (!vaultKeyChanged) {
        errorMessage = 'Invalid decryption key or file format error. The file encryption may be corrupted.';
          errorCode = 'DECRYPT_ERROR';
        }
        needsRepair = true;
        
        // Try to update the file's status
        try {
          await supabase
            .from('files')
            .update({
              encryption_status: 'needs_repair',
              updated_at: new Date().toISOString()
            })
            .eq('file_id', file_id);
            
          console.log(`Marked file ${file_id} for repair due to decryption error`);
        } catch (repairError) {
          console.error('Failed to mark file for repair:', repairError);
        }
      } else if (decryptError.message && decryptError.message.includes('IV')) {
        errorMessage = 'Initialization Vector (IV) error. The file may need to be re-uploaded.';
        errorCode = 'IV_ERROR';
        needsRepair = true;
      }
      
      return res.status(400).json({ 
        error: errorMessage,
        code: errorCode,
        needsRepair: needsRepair,
        vaultKeyChanged: vaultKeyChanged,
        details: needsRepair ? 'Contact support or try re-uploading this file' : undefined
      });
    }
  } catch (err) {
    console.error('File decryption error:', err);
    res.status(500).json({ error: 'Failed to decrypt file' });
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

    // Get file and encryption details from Supabase
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select(`
        *,
        vaults(vault_name)
      `)
      .eq('file_id', fileId)
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
      .eq('user_id', userId)
      .single();
      
    if (accessError || !vaultAccess) {
      console.error('Access check error:', accessError);
      return res.status(403).json({ error: 'You do not have permission to access this file' });
    }

    // Log file preview BEFORE handling the preview
    await logActivity(
      userId,
      'FILE_PREVIEW',
      `Previewed file: ${file.file_name} in vault: ${file.vaults?.vault_name || 'Unknown vault'}`,
      file.vault_id,
      fileId,
      req
    );

    const fileName = file.file_name;
    const fileType = path.extname(fileName).toLowerCase().replace('.', '');

    console.log('File Type:', fileType);

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
        // Download the encrypted file from Supabase Storage
        const storageClient = serviceClient || supabase;
        const { data: encryptedFileData, error: downloadError } = await storageClient
          .storage
          .from(file.storage_bucket)
          .download(file.storage_path);

        if (downloadError) {
          console.error('Error downloading encrypted file:', downloadError);
          return res.status(500).json({ error: 'Failed to retrieve encrypted file' });
        }

        // Convert Blob to buffer for decryption
        const encryptedDataHex = await blobToHexString(encryptedFileData);
        
        // Decrypt the file
        const decryptedData = decryptFile(encryptedDataHex, decryption_key, file.iv);
        
        // Write to temporary file
        const tempFilePath = `/tmp/${fileId}.${fileType}`;
        fs.writeFileSync(tempFilePath, decryptedData);
        
        // Process the Excel file
        const workbook = XLSX.readFile(tempFilePath);
        
        // Remove the temporary file
        fs.unlinkSync(tempFilePath);
        
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

    // Get file and encryption details from Supabase
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select(`
        *,
        file_encryption_keys!file_encryption_keys_file_id_fkey(hashed_key),
        vaults(vault_name)
      `)
      .eq('file_id', fileId)
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
      .eq('user_id', userId)
      .single();
      
    if (accessError || !vaultAccess) {
      console.error('Access check error:', accessError);
      return res.status(403).json({ error: 'You do not have permission to access this file' });
    }

    // Verify the decryption key before attempting to download and decrypt
    // This depends on the type of encryption used
    if (file.encryption_type === 'vault') {
      // For vault-encrypted files, verify against the vault key
      const { data: vault, error: vaultError } = await supabase
        .from('vaults')
        .select('vault_key')
        .eq('vault_id', file.vault_id)
        .single();
        
      if (vaultError || !vault) {
        console.error('Vault retrieval error during key verification:', vaultError);
        return res.status(404).json({ error: 'Vault not found' });
      }
      
      // Verify the provided key against the vault key
      const isKeyValid = await bcrypt.compare(decryption_key, vault.vault_key);
      if (!isKeyValid) {
        console.error('Invalid vault key provided for file preview');
        return res.status(401).json({ error: 'Invalid decryption key' });
      }
      
      console.log('Vault key verified successfully for file preview');
    } else {
      // For custom-encrypted files, verify against the file's key
      if (!file.file_encryption_keys || file.file_encryption_keys.length === 0) {
        console.error('No encryption key record found for file:', fileId);
        return res.status(404).json({ error: 'Encryption key not found for this file' });
      }
      
      // Verify the key using the stored hash
      const hashedKey = file.file_encryption_keys[0].hashed_key;
      const isKeyValid = await bcrypt.compare(decryption_key, hashedKey);
      
      if (!isKeyValid) {
        console.error('Invalid custom encryption key provided for file preview');
        return res.status(401).json({ error: 'Invalid decryption key' });
      }
      
      console.log('Custom encryption key verified successfully for file preview');
    }

    // Download the encrypted file from Supabase Storage
    const storageClient = serviceClient || supabase;
    const { data: encryptedFileData, error: downloadError } = await storageClient
      .storage
      .from(file.storage_bucket)
      .download(file.storage_path);

    if (downloadError) {
      console.error('Error downloading encrypted file:', downloadError);
      return res.status(500).json({ error: 'Failed to retrieve encrypted file' });
    }

    // Convert Blob to hex string for decryption
    const encryptedDataHex = await blobToHexString(encryptedFileData);
    
    try {
      // Log IV information for debugging
      console.log('Starting file preview with:', {
        fileId: fileId,
        fileName: file.file_name,
        ivValue: file.iv,
        ivLength: file.iv?.length,
        encryptionType: file.encryption_type,
        hasIV: !!file.iv,
      });
      
      // Decrypt the file
      const decryptedData = decryptFile(encryptedDataHex, decryption_key, file.iv);
      
      // Log successful decryption BEFORE sending response
      await logActivity(
        userId,
        'FILE_DECRYPT',
        `Decrypted file for preview: ${file.file_name} from vault: ${file.vaults?.vault_name || 'Unknown vault'}`,
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

// Verify file decryption key before deletion
router.post('/file/verify-delete', async (req, res) => {
  const { file_id, decryption_key, user_id } = req.body;

  try {
    // Validate inputs
    if (!file_id || !decryption_key || !user_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get file and encryption details from Supabase
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select(`
        *,
        file_encryption_keys!file_encryption_keys_file_id_fkey(hashed_key),
        vaults(vault_name)
      `)
      .eq('file_id', file_id)
      .single();

    console.log('File retrieval for verification:', {
      fileId: file_id,
      found: !!file,
      hasEncryptionKeys: file && !!file.file_encryption_keys,
      encryptionKeysCount: file?.file_encryption_keys?.length || 0
    });

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

    // Get the hashed key from the file's encryption keys
    const encryptionKeys = file.file_encryption_keys;
    if (!encryptionKeys || encryptionKeys.length === 0) {
      console.error('No encryption keys found for file:', file.file_id);
      return res.status(404).json({ error: 'Encryption key not found for this file' });
    }
    
    const hashedKey = encryptionKeys[0].hashed_key;
    if (!hashedKey) {
      console.error('Hashed key is missing in the encryption key record');
      return res.status(404).json({ error: 'Encryption key data is incomplete' });
    }

    // Verify the decryption key
    const isKeyValid = await verifyEncryptionKey(decryption_key, hashedKey);
    
    if (!isKeyValid) {
      return res.status(401).json({ error: 'Invalid decryption key' });
    }

    // Store file details for response
    const fileDetails = {
      file_id: file.file_id,
      file_name: file.file_name,
      vault_name: file.vaults?.vault_name || 'Unknown vault'
    };

    // Log the verification attempt
    try {
      await logActivity(
        user_id,
        'FILE_DELETE_VERIFY',
        `Verified decryption key for file deletion: ${file.file_name}`,
        file.vault_id,
        file_id,
        req
      );
    } catch (logError) {
      console.error('Error logging verification activity:', logError);
      // Continue even if logging fails
    }

    // Return success with file details
    res.json({
      message: 'Decryption key verified successfully',
      file: fileDetails
    });
  } catch (err) {
    console.error('File verification error:', err);
    res.status(500).json({ error: 'Failed to verify decryption key' });
  }
});

// Delete file route
router.delete('/file/delete/:fileId', async (req, res) => {
  const { fileId } = req.params;
  const { user_id } = req.body;

  try {
    // Validate user_id
    if (!user_id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get file details from Supabase
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select(`
        *,
        vaults(vault_name)
      `)
      .eq('file_id', fileId)
      .single();

    if (fileError || !file) {
      console.error('File retrieval error:', fileError);
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Ensure the user has permission to delete this file
    const { data: vaultAccess, error: accessError } = await supabase
      .from('vaults')
      .select('vault_id')
      .eq('vault_id', file.vault_id)
      .eq('user_id', user_id)
      .single();
      
    if (accessError || !vaultAccess) {
      console.error('Access check error:', accessError);
      return res.status(403).json({ error: 'You do not have permission to delete this file' });
    }

    // Store file information for response before deletion
    const fileName = file.file_name;
    const vaultName = file.vaults?.vault_name || 'Unknown vault';
    const vaultId = file.vault_id;

    // Log the deletion BEFORE deleting the file to avoid foreign key constraint issues
    try {
      await logActivity(
        user_id,
        'FILE_DELETE',
        `Deleted file: ${fileName} from vault: ${vaultName}`,
        vaultId,
        fileId,
        req
      );
    } catch (logError) {
      console.error('Error logging activity:', logError);
      // Continue with deletion even if logging fails
    }

    // Delete the file from storage
    if (file.storage_bucket && file.storage_path) {
      const storageClient = serviceClient || supabase;
      const { error: storageError } = await storageClient
        .storage
        .from(file.storage_bucket)
        .remove([file.storage_path]);

      if (storageError) {
        console.error('Storage deletion error:', storageError);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete the file's encryption key
    const { error: keyDeleteError } = await supabase
      .from('file_encryption_keys')
      .delete()
      .eq('file_id', fileId);
      
    if (keyDeleteError) {
      console.error('Key deletion error:', keyDeleteError);
      // Continue with file deletion
    }

    // Delete the file record
    const { error: fileDeleteError } = await supabase
      .from('files')
      .delete()
      .eq('file_id', fileId);
      
    if (fileDeleteError) {
      console.error('File record deletion error:', fileDeleteError);
      return res.status(500).json({ error: 'Failed to delete file record' });
    }

    // Update the files_count in the vault (decrement by 1)
    const { count: remainingCount, error: countError } = await supabase
      .from('files')
      .select('*', { count: 'exact', head: true })
      .eq('vault_id', vaultId);
      
    if (countError) {
      console.error('Error counting remaining files:', countError);
    } else {
      const { error: updateVaultError } = await supabase
        .from('vaults')
        .update({ 
          files_count: remainingCount, // Use actual count after deletion
          last_accessed: new Date().toISOString()
        })
        .eq('vault_id', vaultId);

      if (updateVaultError) {
        console.error('Error updating vault file count:', updateVaultError);
        // Continue anyway as the file was deleted successfully
      }
    }

    res.json({ 
      message: 'File deleted successfully',
      fileName: fileName
    });
  } catch (err) {
    console.error('File deletion error:', err);
    res.status(500).json({ error: 'Failed to delete file' });
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


// Change password route
router.post('/auth/change-password', async (req, res) => {
  const { email, currentPassword, newPassword, userId } = req.body;
  
  try {
    // Validate inputs
    if (!email || !currentPassword || !newPassword || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Password complexity validation
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }
    
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({ error: 'Password must contain at least one letter and one number' });
    }
    
    // First, verify the current password by signing in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword
    });
    
    if (signInError) {
      console.error('Password verification failed:', signInError);
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Update the password in Supabase Auth
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    if (updateError) {
      console.error('Password update error:', updateError);
      return res.status(500).json({ error: 'Failed to update password' });
    }
    
    // Record the password change date
    const now = new Date().toISOString();
    
    // Update the user's password change date in profiles table
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({ 
        password_changed_at: now 
      })
      .eq('id', userId);
      
    if (profileUpdateError) {
      console.error('Profile update error:', profileUpdateError);
      // Continue anyway as the password was changed successfully
    }
    
    // Log the activity
    await logActivity(
      userId,
      'PASSWORD_CHANGE',
      'Changed account password',
      null,
      null,
      req
    );
    
    res.json({ 
      message: 'Password changed successfully',
      passwordChangeDate: now
    });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ error: 'Failed to change password', details: err.message });
  }
});

// Change vault key route
router.post('/vaults/:vaultId/change-key', async (req, res) => {
  const { vaultId } = req.params;
  const { currentKey, newKey, userId } = req.body;
  
  // Log request details (without exposing keys)
  console.log('Vault key change request received:', {
    vaultId,
    userId,
    hasCurrentKey: !!currentKey,
    hasNewKey: !!newKey,
    body: { ...req.body, currentKey: '[REDACTED]', newKey: '[REDACTED]' }
  });
  
  try {
    // Make sure bcrypt is properly imported
    if (!bcrypt || typeof bcrypt.compare !== 'function' || typeof bcrypt.hash !== 'function') {
      console.error('bcrypt is not properly imported or initialized');
      return res.status(500).json({ error: 'Internal server error with encryption library' });
    }
    
    // Validate inputs
    if (!vaultId || !currentKey || !newKey || !userId) {
      console.error('Missing required fields for vault key change:', {
        hasVaultId: !!vaultId,
        hasCurrentKey: !!currentKey,
        hasNewKey: !!newKey,
        hasUserId: !!userId
      });
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Vault key complexity validation - ensure it's strong enough
    if (newKey.length < 8) {
      return res.status(400).json({ error: 'New vault key must be at least 8 characters long' });
    }
    
    // Get the vault
    const { data: vault, error: vaultError } = await supabase
      .from('vaults')
      .select('*')
      .eq('vault_id', vaultId)
      .eq('user_id', userId)
      .single();
      
    if (vaultError || !vault) {
      console.error('Vault retrieval error:', vaultError);
      return res.status(404).json({ error: 'Vault not found or unauthorized access' });
    }
    
    console.log('Vault found, verifying key');
    
    try {
      // Verify the current key matches
      const isKeyValid = await bcrypt.compare(currentKey, vault.vault_key);
      
      if (!isKeyValid) {
        console.error('Invalid vault key provided for vault:', vaultId);
        return res.status(401).json({ error: 'Current vault key is incorrect' });
      }
      
      console.log('Key verified, updating vault key');
      
      // Hash the new vault key
      const saltRounds = 10;
      const hashedNewKey = await bcrypt.hash(newKey, saltRounds);
      
      // Get current time for update
      const now = new Date().toISOString();
      
      // Create the update object with updated_at since it now exists in the schema
      const updateData = {
        vault_key: hashedNewKey,
        updated_at: now
      };
      
      console.log('Update data structure:', Object.keys(updateData));
      
      // Update the vault with the new key
      const { error: updateError } = await supabase
        .from('vaults')
        .update(updateData)
        .eq('vault_id', vaultId)
        .eq('user_id', userId);
        
      if (updateError) {
        console.error('Vault key update error:', updateError);
          return res.status(500).json({ error: 'Failed to update vault key in database', details: updateError.message });
      }
      
      console.log('Vault key updated successfully for vault:', vaultId);
      
      // Check for files encrypted with this vault key (just for informational purposes)
      const { data: vaultEncryptedFiles, error: filesQueryError } = await supabase
        .from('files')
        .select('count')
        .eq('vault_id', vaultId)
        .eq('encryption_type', 'vault');
        
      let encryptedFilesCount = 0;
      
      if (!filesQueryError && vaultEncryptedFiles) {
        encryptedFilesCount = vaultEncryptedFiles.length || 0;
        console.log(`Found ${encryptedFilesCount} files using vault encryption (will remain with old key)`);
      }
      
      // Log the activity
      await logActivity(
        userId,
        'VAULT_KEY_CHANGE',
        `Changed encryption key for vault: ${vault.vault_name}`,
        vaultId,
        null,
        req
      );
      
      res.json({ 
        message: 'Vault key changed successfully',
        vaultName: vault.vault_name,
        vaultId: vault.vault_id || vaultId,
        note: encryptedFilesCount > 0 ? 
          `You have ${encryptedFilesCount} files encrypted with the previous vault key. To access these files, you'll need to use the original vault key that was active when they were uploaded.` : 
          null,
        filesCount: encryptedFilesCount
      });
    } catch (bcryptError) {
      console.error('Bcrypt operation failed:', bcryptError);
      return res.status(500).json({ error: 'Encryption operation failed', details: bcryptError.message });
    }
  } catch (err) {
    console.error('Vault key change error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: 'Failed to change vault key', details: err.message });
  }
});

// Change file encryption key route
router.post('/files/:fileId/change-key', async (req, res) => {
  const { fileId } = req.params;
  const { currentKey, newKey, userId } = req.body;
  
  // Log request details (without exposing keys)
  console.log('File key change request received:', {
    fileId,
    userId,
    hasCurrentKey: !!currentKey,
    hasNewKey: !!newKey,
    body: { ...req.body, currentKey: '[REDACTED]', newKey: '[REDACTED]' }
  });
  
  try {
    // Validate inputs
    if (!fileId || !currentKey || !newKey || !userId) {
      console.error('Missing required fields for file key change');
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Verify file exists and user has access
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select(`
        *,
        file_encryption_keys!file_encryption_keys_file_id_fkey(key_id, hashed_key),
        vaults!inner(user_id, vault_key, vault_name)
      `)
      .eq('file_id', fileId)
      .single();
      
    if (fileError || !file) {
      console.error('File retrieval error:', fileError);
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Verify the user has access to this file
    if (file.vaults.user_id !== userId) {
      console.error('Unauthorized file access attempt');
      return res.status(403).json({ error: 'You do not have permission to modify this file' });
    }
    
    // Step 1: Attempt direct decryption without verifying keys first
    // This approach will work regardless of encryption type and supports using old vault keys
    try {
      console.log('Downloading encrypted file for re-encryption');
      const storageClient = serviceClient || supabase;
      const { data: encryptedFileData, error: downloadError } = await storageClient
        .storage
        .from(file.storage_bucket)
        .download(file.storage_path);
        
      if (downloadError) {
        console.error('Error downloading file for re-encryption:', downloadError);
        return res.status(500).json({ error: 'Failed to download file for re-encryption' });
      }
      
      // Convert Blob to hex string for decryption
      const encryptedHex = await blobToHexString(encryptedFileData);
      
      // Log useful information for debugging
      console.log('Decryption attempt details:', {
        fileId: fileId,
        fileName: file.file_name,
        encryptionType: file.encryption_type,
        ivValue: file.iv,
        ivLength: file.iv?.length,
        hasEncryptedData: !!encryptedHex,
        encryptedDataLength: encryptedHex?.length,
        keyProvided: !!currentKey
      });
      
      // Decrypt with the current key directly
      console.log('Attempting decryption with provided key');
      const decryptedData = decryptFile(encryptedHex, currentKey, file.iv);
      
      // If we get here, decryption was successful - continue with re-encryption
      console.log('Decryption successful, proceeding with re-encryption');
      
      // Step 2: Re-encrypt with the new key
      console.log('Re-encrypting file with new key');
      const encryptionResult = encryptFile(decryptedData, newKey);
      const newIv = encryptionResult.iv;
      const newEncryptedData = encryptionResult.encryptedData;
      
      console.log('Encryption result:', {
        newIvLength: newIv.length,
        newIvFormat: typeof newIv,
        hasEncryptedData: !!newEncryptedData,
        encryptedDataLength: newEncryptedData.length
      });
      
      // Validate IV format before proceeding
      let finalIv = newIv;
      if (!finalIv || typeof finalIv !== 'string' || finalIv.length !== 32) {
        console.error('Invalid IV format generated:', {
          iv: finalIv,
          type: typeof finalIv,
          length: finalIv?.length
        });
        // Create a valid IV if needed
        finalIv = crypto.randomBytes(16).toString('hex');
        console.log('Created new valid IV:', finalIv);
      }
      
      // Step 3: Upload the re-encrypted file back to storage
      console.log('Uploading re-encrypted file to storage');
      const { error: uploadError } = await storageClient
        .storage
        .from(file.storage_bucket)
        .upload(file.storage_path, Buffer.from(newEncryptedData, 'hex'), {
          contentType: 'application/octet-stream',
          upsert: true
        });
        
      if (uploadError) {
        console.error('Error uploading re-encrypted file:', uploadError);
        return res.status(500).json({ error: 'Failed to store re-encrypted file' });
      }
      
      // Step 4: Hash the new key for storage
      const saltRounds = 10;
      const hashedNewKey = await bcrypt.hash(newKey, saltRounds);
      
      // Step 5: Determine if we're changing encryption type
      let newEncryptionType = file.encryption_type;
      let changeMessage;
      
      if (file.encryption_type === 'vault') {
        // If changing from vault to custom key
        newEncryptionType = 'custom';
        changeMessage = `Changed file encryption from vault key to custom key: ${file.file_name}`;
      } else {
        // If just changing a custom key
        changeMessage = `Changed encryption key for file: ${file.file_name}`;
      }
      
      // Step 6: Update file record with new IV and possibly encryption type
      console.log('Updating file metadata');
      let updatedFile;
      
      const fileUpdateData = {
        iv: finalIv,
        updated_at: new Date().toISOString()
      };
      
      // Add encryption_type only if it's changing
      if (newEncryptionType !== file.encryption_type) {
        fileUpdateData.encryption_type = newEncryptionType;
        }
        
        const { data: fileData, error: fileUpdateError } = await supabase
          .from('files')
          .update(fileUpdateData)
          .eq('file_id', fileId)
          .select()
          .single();
          
        if (fileUpdateError) {
          console.error('Error updating file metadata:', fileUpdateError);
          
          // Try updating fields one by one as a fallback
          console.log('Attempting alternative update approach...');
          
        // First update the IV - this is most important
          const { error: ivUpdateError } = await supabase
            .from('files')
          .update({ iv: finalIv })
            .eq('file_id', fileId);
            
          if (ivUpdateError) {
            console.error('Failed to update IV:', ivUpdateError);
            return res.status(500).json({ 
              error: 'Failed to update file IV', 
            details: 'The encryption was successful, but metadata could not be updated completely.'
            });
          }
          
        // Update other fields separately
        await supabase
              .from('files')
          .update({ 
            updated_at: new Date().toISOString(),
            encryption_type: newEncryptionType 
          })
              .eq('file_id', fileId);
              
        // Get the updated file
          const { data: reloadedFile } = await supabase
            .from('files')
            .select('*')
            .eq('file_id', fileId)
            .single();
            
          updatedFile = reloadedFile || file;
        } else {
          updatedFile = fileData;
      }
      
      // Step 7: If file is using custom encryption, update the key record
      if (file.file_encryption_keys && file.file_encryption_keys.length > 0) {
        // Update existing key record
        const fileKeyId = file.file_encryption_keys[0].key_id;
        
        const { error: keyUpdateError } = await supabase
        .from('file_encryption_keys')
        .update({ hashed_key: hashedNewKey })
        .eq('key_id', fileKeyId)
          .eq('file_id', fileId);
          
        if (keyUpdateError) {
          console.error('Error updating existing key record:', keyUpdateError);
        }
      } else if (newEncryptionType === 'custom') {
        // Create new key record if switching to custom
        const { error: newKeyError } = await supabase
          .from('file_encryption_keys')
          .insert({
            file_id: fileId,
            hashed_key: hashedNewKey,
            created_at: new Date().toISOString()
          });
          
        if (newKeyError) {
          console.error('Error creating new key record:', newKeyError);
        }
      }
      
      // Step 8: Log the activity
      await logActivity(
        userId,
        'FILE_KEY_CHANGE',
        changeMessage,
        file.vault_id,
        fileId,
        req
      );
      
      // Step 9: Return appropriate response
      const successMessage = newEncryptionType !== file.encryption_type
        ? 'File encryption changed from vault key to custom key successfully'
        : 'File encryption key changed successfully';
        
      return res.json({
        message: successMessage,
        file: {
          fileName: file.file_name,
          fileId: file.file_id,
          encryptionType: newEncryptionType,
          vaultName: file.vaults.vault_name,
          updatedAt: updatedFile ? updatedFile.updated_at : new Date().toISOString()
        }
      });
      
    } catch (decryptError) {
      // If decryption fails, the key is invalid
      console.error('Decryption with provided key failed:', decryptError);
      
      let errorMessage = 'Invalid decryption key';
      let errorDetails = 'The key provided cannot decrypt this file.';
      
      // Check if this might be a vault key change issue
      if (file.encryption_type === 'vault' && 
          (decryptError.code === 'ERR_OSSL_BAD_DECRYPT' || 
          (decryptError.message && decryptError.message.includes('bad decrypt')))) {
            
        errorMessage = 'Invalid vault key';
        errorDetails = 'If the vault key has been changed, please use the original key that was active when this file was uploaded.';
      }
      
      return res.status(401).json({ 
        error: errorMessage, 
        details: errorDetails,
        fileId: fileId,
        fileName: file.file_name,
        encryptionType: file.encryption_type
      });
    }
  } catch (err) {
    console.error('File key change error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ error: 'Failed to change file encryption key', details: err.message });
  }
});

// Activity Log Routes
router.post('/activities', async (req, res) => {
  const { userId, actionType, details, vaultId, fileId } = req.body;
  
  try {
    if (!userId || !actionType || !details) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await logActivity(userId, actionType, details, vaultId, fileId, req);
    
    res.status(201).json({ 
      message: 'Activity logged successfully', 
      logId: result.log_id 
    });
  } catch (err) {
    console.error('Activity logging error:', err);
    res.status(500).json({ error: 'Failed to log activity' });
  }
});

// Get activities for a user with pagination
router.get('/activities/:userId', async (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  
  try {
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const activities = await getActivities(userId, page, limit);
    res.json(activities);
  } catch (err) {
    console.error('Activity fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Search activities with filters
router.post('/activities/search/:userId', async (req, res) => {
  const { userId } = req.params;
  const { searchTerm, filters, page, limit } = req.body;
  
  try {
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    
    const activities = await searchActivities(userId, searchTerm, filters, pageNum, limitNum);
    res.json(activities);
  } catch (err) {
    console.error('Activity search error:', err);
    res.status(500).json({ error: 'Failed to search activities' });
  }
});

// Export activities with filters
router.post('/activities/export/:userId', async (req, res) => {
  const { userId } = req.params;
  const { filters = {}, format = 'csv' } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  
  try {
    // Query to fetch activities based on filters
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
      `)
      .eq('user_id', userId);
    
    // Apply filters if provided
    if (filters.actionType) {
      query = query.eq('action_type', filters.actionType);
    }
    
    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    
    if (filters.endDate) {
      // Add 23:59:59 to include the entire end date
      const endDateWithTime = new Date(filters.endDate);
      endDateWithTime.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endDateWithTime.toISOString());
    }
    
    // Order by created_at in descending order
    query = query.order('created_at', { ascending: false });
    
    // Execute the query
    const { data: activities, error } = await query;
    
    if (error) {
      console.error('Error fetching activities for export:', error);
      return res.status(500).json({ error: 'Failed to fetch activities' });
    }
    
    // Format the activities data
    const formattedActivities = activities.map(activity => {
      // Extract vault and file information
      const vault_name = activity.vaults?.vault_name || null;
      const file_name = activity.files?.file_name || null;
      const file_type = activity.files?.file_type || null;
      
      // Create a formatted details field
      let details = activity.description || '';
      if (file_name) {
        details += ` | File: ${file_name}`;
        if (file_type) {
          details += ` (${file_type.toUpperCase()})`;
        }
      }
      if (vault_name) {
        details += ` | Vault: ${vault_name}`;
      }
      
      return {
        id: activity.log_id,
        action_type: activity.action_type,
        description: activity.description,
        details: details,
        timestamp: new Date(activity.created_at).toLocaleString(),
        ip_address: activity.ip_address,
        user_agent: activity.user_agent,
        vault_name,
        file_name,
        file_type
      };
    });
    
    // Handle different export formats
    if (format.toLowerCase() === 'csv') {
      // Format as CSV
      const csvRows = [];
      
      // Add headers
      const headers = ['ID', 'Action Type', 'Timestamp', 'Details', 'IP Address', 'User Agent', 'Vault', 'File'];
      csvRows.push(headers.join(','));
      
      // Add data rows
      formattedActivities.forEach(activity => {
        // Escape quotes in details to prevent CSV formatting issues
        const escapedDetails = activity.details.replace(/"/g, '""');
        
        const row = [
          activity.id,
          activity.action_type,
          activity.timestamp,
          `"${escapedDetails}"`, // Wrap in quotes to handle commas in details
          activity.ip_address || '',
          activity.user_agent || '',
          activity.vault_name || '',
          activity.file_name || ''
        ];
        
        csvRows.push(row.join(','));
      });
      
      const csvContent = csvRows.join('\n');
      
      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=activity_logs.csv');
      
      return res.send(csvContent);
    } else {
      return res.status(400).json({ error: 'Unsupported export format. Only CSV format is supported.' });
    }
  } catch (err) {
    console.error('Error exporting activities:', err);
    return res.status(500).json({ error: 'Failed to export activities', details: err.message });
  }
});

// Export the router
export default router; 
