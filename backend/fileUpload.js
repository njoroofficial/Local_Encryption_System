import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Get values from environment variables or use defaults
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const MAX_FILE_SIZE = parseInt(process.env.UPLOAD_MAX_FILE_SIZE) || 100 * 1024 * 1024; // Default 100MB

// Create uploads directory with absolute path
const uploadDir = path.join(process.cwd(), UPLOAD_DIR);
console.log('Upload directory:', uploadDir);

// Ensure the 'uploads' directory exists with proper permissions
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
    console.log('Created uploads directory');
  }
} catch (err) {
  console.error('Error creating uploads directory:', err);
  throw err;
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('Saving file to:', uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const fileExtension = path.extname(file.originalname);
    const newFilename = `${file.fieldname}-${uniqueSuffix}${fileExtension}`;
    console.log('Generated filename:', newFilename);
    cb(null, newFilename);
  }
});

// File filter to restrict file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['pdf', 'png', 'jpg', 'jpeg','docx','doc','txt','xls','xlsx','ppt','pptx'];
  const fileExtension = path.extname(file.originalname).slice(1).toLowerCase();
  
  console.log('File type check:', {
    originalName: file.originalname,
    extension: fileExtension,
    allowed: allowedTypes.includes(fileExtension)
  });

  if (allowedTypes.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, PNG, and JPG files are allowed.'), false);
  }
};

// Configure multer
const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

export default upload;