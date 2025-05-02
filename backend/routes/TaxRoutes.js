const express = require('express');
const router = express.Router();
const TaxController = require('../controllers/TaxController');
const { authMiddleware, isAdmin, checkRole } = require('../middleware/Auth');
const { 
  createTaxValidator, 
  updateTaxValidator,
  documentValidator 
} = require('../services/TaxValidators');

// Protected routes - all tax routes require authentication
// Get all tax cases (admins and support see all, users see their own)
router.get('/', 
  authMiddleware(), 
  TaxController.getAllTaxCases
);

// Get tax case by ID
router.get('/:id', 
  authMiddleware(), 
  TaxController.getTaxCaseById
);

// Create new tax case
router.post('/', 
  authMiddleware(), 
  createTaxValidator, 
  TaxController.createTaxCase
);

// Update tax case
router.put('/:id', 
  authMiddleware(), 
  updateTaxValidator, 
  TaxController.updateTaxCase
);

// Delete tax case (admin or client for pending cases)
router.delete('/:id', 
  authMiddleware(), 
  TaxController.deleteTaxCase
);

// Get user's own tax cases
router.get('/user/cases', 
  authMiddleware(), 
  TaxController.getUserTaxCases
);

// Get tax professional's assigned cases
router.get('/professional/cases', 
  authMiddleware(), 
  checkRole(['ADMIN', 'SUPPORT']),
  TaxController.getProfessionalTaxCases
);

// Update tax case status
router.put('/:id/status', 
  authMiddleware(), 
  checkRole(['ADMIN', 'SUPPORT']),
  TaxController.changeStatus
);

// Assign tax professional to tax case (admin only)
router.put('/:id/assign-professional', 
  authMiddleware(),
  isAdmin,  
  TaxController.assignTaxProfessional
);

// Add document to tax case
router.post('/:id/documents', 
  authMiddleware(),
  documentValidator,
  TaxController.addDocument
);

// Remove document from tax case
router.delete('/:id/documents/:documentIndex', 
  authMiddleware(),
  TaxController.removeDocument
);

// Add this route before module.exports
router.get('/admin/statistics', 
  authMiddleware(), 
  isAdmin, 
  TaxController.getTaxStatistics
);

router.get('/admin/all-cases', 
  authMiddleware(), 
  isAdmin, 
  TaxController.getAllTaxCases
);

module.exports = router;