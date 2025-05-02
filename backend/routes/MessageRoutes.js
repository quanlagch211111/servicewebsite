const express = require('express');
const router = express.Router();
const MessageController = require('../controllers/MessageController');
const { authMiddleware, isAdmin } = require('../middleware/Auth');
const { 
  createMessageValidator, 
  attachmentValidator 
} = require('../services/MessageValidators'); // Bạn sẽ cần tạo file validators này

// Protected routes - all message routes require authentication
// Get all messages with pagination (admins see all, users see their own)
router.get('/', 
  authMiddleware(), 
  MessageController.getAllMessages
);

// Get conversation with a specific user
router.get('/conversation/:userId', 
  authMiddleware(), 
  MessageController.getConversation
);

// Get message by ID
router.get('/:id', 
  authMiddleware(), 
  MessageController.getMessageById
);

// Create new message
router.post('/', 
  authMiddleware(), 
  createMessageValidator, 
  MessageController.createMessage
);

// Mark message as read
router.patch('/:id/read', 
  authMiddleware(), 
  MessageController.markAsRead
);

// Delete message
router.delete('/:id', 
  authMiddleware(), 
  MessageController.deleteMessage
);

// Add attachment to message
router.post('/:id/attachments', 
  authMiddleware(),
  attachmentValidator,
  MessageController.addAttachment
);

// Get count of unread messages
router.get('/user/unread-count', 
  authMiddleware(), 
  MessageController.getUnreadCount
);

// Add this route before module.exports
router.get('/admin/statistics', 
    authMiddleware(), 
    isAdmin, 
    MessageController.getMessageStatistics
  );
  
module.exports = router;