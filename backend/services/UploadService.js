const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
const avatarsDir = path.join(uploadsDir, 'avatars');
const propertiesDir = path.join(uploadsDir, 'properties');
const documentsDir = path.join(uploadsDir, 'documents');

// Ensure directories exist
[uploadsDir, avatarsDir, propertiesDir, documentsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = uploadsDir;
    
    // Determine appropriate subfolder based on file type
    if (req.baseUrl.includes('users') && req.path.includes('avatar')) {
      uploadPath = avatarsDir;
    } else if (req.baseUrl.includes('real-estate')) {
      uploadPath = propertiesDir;
    } else if (req.baseUrl.includes('documents')) {
      uploadPath = documentsDir;
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Create unique filename: timestamp-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure file filter for allowed file types
const fileFilter = (req, file, cb) => {
  // Define allowed MIME types
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const allowedDocumentTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  
  // For user avatars, only allow images
  if (req.baseUrl.includes('users') && req.path.includes('avatar')) {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed for avatars'), false);
    }
  }
  // For property images, only allow images
  else if (req.baseUrl.includes('real-estate')) {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, and WebP images are allowed for property images'), false);
    }
  }
  // For documents, allow images and PDFs
  else if (req.baseUrl.includes('documents')) {
    if ([...allowedImageTypes, ...allowedDocumentTypes].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDF documents are allowed'), false);
    }
  }
  // Default case
  else {
    cb(null, true);
  }
};

// Configure upload limits
const limits = {
  fileSize: 10 * 1024 * 1024, // 10MB file size limit
};

// Create the upload middleware
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: limits
});

// Helper to get the server URL
const getServerUrl = (req) => {
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}`;
};

// Convert local file path to URL
const getFileUrl = (req, filePath) => {
  if (!filePath) return null;
  
  const relativePath = path.relative(path.join(__dirname, '..'), filePath);
  return `${getServerUrl(req)}/${relativePath.replace(/\\/g, '/')}`;
};

// Handle file deletion
const deleteFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
};

module.exports = {
  upload,
  getFileUrl,
  deleteFile,
  avatarsDir,
  propertiesDir,
  documentsDir
};