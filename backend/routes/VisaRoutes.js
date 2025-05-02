const express = require('express');
const router = express.Router();
const VisaController = require('../controllers/VisaController');
const { authMiddleware, isAdmin, checkRole } = require('../middleware/Auth');
const { 
  createVisaValidator, 
  updateVisaValidator,
  documentValidator 
} = require('../services/VisaValidators');

// Protected routes - all visa routes require authentication
// Get all visa applications (admins and agents see all, users see their own)
router.get('/', 
  authMiddleware(), 
  VisaController.getAllVisaApplications
);

// Get visa application by ID
router.get('/:id', 
  authMiddleware(), 
  VisaController.getVisaApplicationById
);

// Create new visa application
router.post('/', 
  authMiddleware(), 
  createVisaValidator, 
  VisaController.createVisaApplication
);

// Update visa application
router.put('/:id', 
  authMiddleware(), 
  updateVisaValidator, 
  VisaController.updateVisaApplication
);

// Delete visa application (admin or applicant for submitted applications)
router.delete('/:id', 
  authMiddleware(), 
  VisaController.deleteVisaApplication
);

// Get user's own visa applications
router.get('/user/applications', 
  authMiddleware(), 
  VisaController.getUserVisaApplications
);

// Get agent's assigned visa applications
router.get('/agent/applications', 
  authMiddleware(), 
  checkRole(['ADMIN', 'AGENT']),
  VisaController.getAgentVisaApplications
);

// Update visa application status
router.put('/:id/status', 
  authMiddleware(), 
  checkRole(['ADMIN', 'AGENT']),
  VisaController.changeStatus
);

// Assign agent to visa application (admin only)
router.put('/:id/assign-agent', 
  authMiddleware(),
  isAdmin,  
  VisaController.assignAgent
);

// Add document to visa application
router.post('/:id/documents', 
  authMiddleware(),
  documentValidator,
  VisaController.addDocument
);

// Remove document from visa application
router.delete('/:id/documents/:documentIndex', 
  authMiddleware(),
  VisaController.removeDocument
);


// Add this route before module.exports
router.get('/admin/statistics', 
  authMiddleware(), 
  isAdmin, 
  VisaController.getVisaStatistics
);

router.get('/admin/all-applications', 
  authMiddleware(), 
  isAdmin, 
  VisaController.getAllVisaApplications
);
module.exports = router;