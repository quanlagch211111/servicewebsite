const express = require('express');
const router = express.Router();
const InsuranceController = require('../controllers/InsuranceController');
const { authMiddleware, isAdmin, checkRole } = require('../middleware/Auth');
const { 
  createPolicyValidator, 
  updatePolicyValidator,
  beneficiaryValidator
} = require('../services/InsuranceValidators');

// Protected routes - all insurance routes require authentication
// Get all policies (admins and agents see all, users see their own)
router.get('/', 
  authMiddleware(), 
  InsuranceController.getAllPolicies
);

// Get policy by ID
router.get('/:id', 
  authMiddleware(), 
  InsuranceController.getPolicyById
);

// Create new policy
router.post('/', 
  authMiddleware(), 
  createPolicyValidator, 
  InsuranceController.createPolicy
);

// Update policy
router.put('/:id', 
  authMiddleware(), 
  updatePolicyValidator, 
  InsuranceController.updatePolicy
);

// Delete policy (admin only)
router.delete('/:id', 
  authMiddleware(),
  isAdmin, 
  InsuranceController.deletePolicy
);

// Get user's own policies
router.get('/user/policies', 
  authMiddleware(), 
  InsuranceController.getUserPolicies
);

// Update policy status
router.put('/:id/status', 
  authMiddleware(), 
  InsuranceController.changeStatus
);

// Assign agent to policy (admin only)
router.put('/:id/assign-agent', 
  authMiddleware(),
  isAdmin,  
  InsuranceController.assignAgent
);

// Add beneficiary to policy
router.post('/:id/beneficiaries', 
  authMiddleware(),
  beneficiaryValidator,
  InsuranceController.addBeneficiary
);

// Remove beneficiary from policy
router.delete('/:id/beneficiaries/:beneficiaryIndex', 
  authMiddleware(),
  InsuranceController.removeBeneficiary
);

router.get('/admin/all-policies', 
  authMiddleware(), 
  isAdmin, 
  InsuranceController.getAllPolicies
);
// Add this route before module.exports
router.get('/admin/statistics', 
  authMiddleware(), 
  isAdmin, 
  InsuranceController.getInsuranceStatistics
);

module.exports = router;