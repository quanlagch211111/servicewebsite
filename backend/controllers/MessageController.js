const Message = require('../models/Message');
const User = require('../models/User');

// Get all messages with pagination and filtering
const getAllMessages = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const userId = req.user.payload.id;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';
    
    // Filtering - users can only see their own messages, admins can see all
    const filter = {};
    if (!isAdmin) {
      filter.$or = [{ sender: userId }, { recipient: userId }];
    }

    // Additional filters
    if (req.query.sender) {
      filter.sender = req.query.sender;
    }
    
    if (req.query.recipient) {
      filter.recipient = req.query.recipient;
    }

    if (req.query.isRead !== undefined) {
      filter.isRead = req.query.isRead === 'true';
    }

    // Execute query with pagination
    const messages = await Message.find(filter)
      .populate('sender', 'username email avatar')
      .populate('recipient', 'username email avatar')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination info
    const total = await Message.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: messages.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      messages
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
};

// Get message conversation between two users
const getConversation = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.payload.id;
    
    // Check if specified user exists
    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get messages between the two users
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: userId },
        { sender: userId, recipient: currentUserId }
      ]
    })
    .populate('sender', 'username email avatar')
    .populate('recipient', 'username email avatar')
    .sort({ created_at: 1 });

    res.status(200).json({
      success: true,
      count: messages.length,
      messages
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation',
      error: error.message
    });
  }
};

// Get message by ID
const getMessageById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.payload.id;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';

    const message = await Message.findById(id)
      .populate('sender', 'username email avatar')
      .populate('recipient', 'username email avatar');

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check permissions - only allow access to own messages unless admin
    if (!isAdmin && message.sender.toString() !== userId && message.recipient.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own messages'
      });
    }

    res.status(200).json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Error fetching message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch message',
      error: error.message
    });
  }
};

// Create new message
const createMessage = async (req, res) => {
  try {
    const { recipientId, content, attachments } = req.body;
    const senderId = req.user.payload.id;

    // Check if recipient exists
    const recipientExists = await User.findById(recipientId);
    if (!recipientExists) {
      return res.status(404).json({
        success: false,
        message: 'Recipient not found'
      });
    }

    // Create message
    const newMessage = new Message({
      sender: senderId,
      recipient: recipientId,
      content,
      attachments: attachments || [],
      isRead: false,
      created_at: Date.now()
    });

    const savedMessage = await newMessage.save();

    // Populate the response data
    const populatedMessage = await Message.findById(savedMessage._id)
      .populate('sender', 'username email avatar')
      .populate('recipient', 'username email avatar');

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: populatedMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
};

// Mark message as read
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.payload.id;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';

    // Find the message
    const message = await Message.findById(id);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user has permission to mark message as read
    if (!isAdmin && message.recipient.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to mark this message as read'
      });
    }

    // Update the message
    const updatedMessage = await Message.findByIdAndUpdate(
      id,
      { isRead: true },
      { new: true, runValidators: true }
    )
    .populate('sender', 'username email avatar')
    .populate('recipient', 'username email avatar');

    res.status(200).json({
      success: true,
      message: 'Message marked as read successfully',
      data: updatedMessage
    });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark message as read',
      error: error.message
    });
  }
};

// Delete message
const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.payload.id;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';

    // Find the message
    const message = await Message.findById(id);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user has permission to delete
    if (!isAdmin && message.sender.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this message'
      });
    }

    // Delete the message
    await Message.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: error.message
    });
  }
};

// Add attachment to message
const addAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const { attachmentUrl } = req.body;
    const userId = req.user.payload.id;
    
    if (!attachmentUrl) {
      return res.status(400).json({
        success: false,
        message: 'Attachment URL is required'
      });
    }

    // Find the message
    const message = await Message.findById(id);
    
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user has permission to add attachments
    if (message.sender.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to add attachments to this message'
      });
    }

    // Add the attachment
    message.attachments.push(attachmentUrl);
    
    await message.save();

    const updatedMessage = await Message.findById(id)
      .populate('sender', 'username email avatar')
      .populate('recipient', 'username email avatar');

    res.status(200).json({
      success: true,
      message: 'Attachment added successfully',
      data: updatedMessage
    });
  } catch (error) {
    console.error('Error adding attachment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add attachment',
      error: error.message
    });
  }
};

// Get unread message count
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.payload.id;
    
    // Count unread messages where user is recipient
    const unreadCount = await Message.countDocuments({
      recipient: userId,
      isRead: false
    });

    res.status(200).json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error('Error counting unread messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to count unread messages',
      error: error.message
    });
  }
};

// Add this method
const getMessageStatistics = async (req, res) => {
    try {
      // Get total messages
      const total = await Message.countDocuments();
      
      // Get unread messages
      const unread = await Message.countDocuments({ isRead: false });
      
      res.status(200).json({
        success: true,
        stats: {
          total,
          unread
        }
      });
    } catch (error) {
      console.error('Error getting message statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch message statistics',
        error: error.message
      });
    }
  };
  

module.exports = {
  getAllMessages,
  getConversation,
  getMessageById,
  createMessage,
  markAsRead,
  deleteMessage,
  addAttachment,
  getUnreadCount,
  getMessageStatistics
};