const express = require('express');
const router = express.Router();
const RealEstateController = require('../controllers/RealEstateController');
const { authMiddleware, isAdmin, checkRole } = require('../middleware/Auth');
const { 
  createPropertyValidator, 
  updatePropertyValidator 
} = require('../services/RealEstateValidators');
const { upload } = require('../services/UploadService');

// Public routes
router.get('/', RealEstateController.getAllProperties);
router.get('/:id', RealEstateController.getPropertyById);

// Protected routes - require authentication
router.post('/', 
  authMiddleware(), 
  createPropertyValidator, 
  RealEstateController.createProperty
);

router.put('/:id', 
  authMiddleware(), 
  updatePropertyValidator, 
  RealEstateController.updateProperty
);

router.delete('/:id', 
  authMiddleware(), 
  RealEstateController.deleteProperty
);

router.get('/user/properties', 
  authMiddleware(), 
  RealEstateController.getUserProperties
);

router.put('/:id/status', 
  authMiddleware(), 
  RealEstateController.changePropertyStatus
);

// Agent assignment - only for admins and property owners
router.put('/:id/assign-agent', 
  authMiddleware(), 
  RealEstateController.assignAgent
);

// Admin routes
router.get('/admin/all-properties', 
  authMiddleware(), 
  isAdmin, 
  RealEstateController.getAllProperties
);

// Property images upload route
router.post('/:id/images', 
  authMiddleware(), 
  upload.array('images', 10), // Allow up to 10 images
  RealEstateController.uploadImages
);

// Add this route for deleting property images
router.delete('/:id/images/:imageIndex', 
  authMiddleware(), 
  RealEstateController.deleteImage
);

router.get('/admin/statistics', 
  authMiddleware(), 
  isAdmin, 
  RealEstateController.getPropertyStatistics
);

module.exports = router;