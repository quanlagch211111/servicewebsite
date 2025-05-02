const express = require('express');
const router = express.Router();
const AppointmentController = require('../controllers/AppointmentController');
const { authMiddleware, isAdmin, checkRole } = require('../middleware/Auth');
const { 
  appointmentRequestValidator, 
  appointmentUpdateValidator,
  statusValidator
} = require('../services/AppointmentValidators');

// Protected routes - all appointment routes require authentication
// Get all appointments (admins and staff see all relevant, users see their own)
router.get('/', 
  authMiddleware(), 
  AppointmentController.getAllAppointments
);

// Get appointment by ID
router.get('/:id', 
  authMiddleware(), 
  AppointmentController.getAppointmentById
);

// Request new appointment
router.post('/', 
  authMiddleware(), 
  appointmentRequestValidator, 
  AppointmentController.requestAppointment
);

// Update appointment (staff or admin only)
router.put('/:id', 
  authMiddleware(), 
  appointmentUpdateValidator, 
  AppointmentController.updateAppointment
);

// Cancel appointment (can be done by client, assigned staff, or admin)
router.post('/:id/cancel', 
  authMiddleware(), 
  AppointmentController.cancelAppointment
);

// Get user's appointments (both as client and staff)
router.get('/user/appointments', 
  authMiddleware(), 
  AppointmentController.getUserAppointments
);

// Get staff appointments (for assigned staff only)
router.get('/staff/appointments', 
  authMiddleware(), 
  checkRole(['ADMIN', 'AGENT', 'SUPPORT']),
  AppointmentController.getStaffAppointments
);

// Reassign appointment to different staff (admin only)
router.put('/:id/reassign', 
  authMiddleware(), 
  isAdmin, 
  AppointmentController.reassignAppointment
);

// Change appointment status (staff or admin only)
router.put('/:id/status', 
  authMiddleware(), 
  statusValidator,
  AppointmentController.changeStatus
);

// Add this route before module.exports
router.get('/admin/statistics', 
  authMiddleware(), 
  isAdmin, 
  AppointmentController.getAppointmentStatistics
);

module.exports = router;