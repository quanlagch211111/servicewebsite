const express = require('express');
const router = express.Router();
const TicketController = require('../controllers/TicketController');
const { authMiddleware, isAdmin, checkRole } = require('../middleware/Auth');
const { 
  createTicketValidator, 
  updateTicketValidator,
  messageValidator,
  attachmentsValidator
} = require('../services/TicketValidators');

// All ticket routes require authentication
// Get all tickets based on user role (admins see all, users see their own)
router.get('/', 
  authMiddleware(), 
  TicketController.getAllTickets
);

// Get specific ticket by ID
router.get('/:id', 
  authMiddleware(), 
  TicketController.getTicketById
);

// Create new ticket
router.post('/', 
  authMiddleware(), 
  createTicketValidator, 
  TicketController.createTicket
);

// Update ticket
router.put('/:id', 
  authMiddleware(), 
  updateTicketValidator, 
  TicketController.updateTicket
);

// Delete ticket (admin only)
router.delete('/:id', 
  authMiddleware(),
  isAdmin, 
  TicketController.deleteTicket
);

// Get user's own tickets
router.get('/user/tickets', 
  authMiddleware(), 
  TicketController.getUserTickets
);

// Get tickets assigned to staff member
router.get('/staff/assigned', 
  authMiddleware(), 
  checkRole(['ADMIN', 'SUPPORT', 'AGENT']),
  TicketController.getAssignedTickets
);

// Assign ticket to staff member (admin and support)
router.put('/:id/assign', 
  authMiddleware(),
  checkRole(['ADMIN', 'SUPPORT']),
  TicketController.assignTicket
);

// Change ticket status
router.put('/:id/status', 
  authMiddleware(), 
  TicketController.changeStatus
);

// Add message to ticket
router.post('/:id/messages', 
  authMiddleware(),
  messageValidator,
  attachmentsValidator,
  TicketController.addMessage
);

// Get tickets by category
router.get('/category/:category',
  authMiddleware(),
  TicketController.getTicketsByCategory
);

// Get tickets by priority
router.get('/priority/:priority',
  authMiddleware(),
  TicketController.getTicketsByPriority
);

// Get ticket statistics (admin dashboard)
router.get('/admin/statistics',
  authMiddleware(),
  checkRole(['ADMIN', 'SUPPORT']),
  TicketController.getTicketsStatistics
);

router.get('/admin/all-tickets', 
  authMiddleware(), 
  isAdmin, 
  TicketController.getAllTickets
);

module.exports = router;