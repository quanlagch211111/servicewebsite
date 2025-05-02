const Ticket = require('../models/Ticket');
const User = require('../models/User');
const EmailService = require('../services/EmailService');
const mongoose = require('mongoose');

// Get all tickets with pagination and filtering
const getAllTickets = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Basic filtering options
    const filter = {};

    // Admins and support staff can see all, users can only see their own, agents see assigned tickets
    const userId = req.user?.payload?.id;
    const userRole = req.user?.payload?.role;
    const isAdmin = req.user?.payload?.isAdmin || userRole === 'ADMIN';
    const isSupport = userRole === 'SUPPORT';
    const isAgent = userRole === 'AGENT';

    if (!isAdmin && !isSupport) {
      if (isAgent) {
        // Agents see tickets assigned to them or with no assignee
        filter.$or = [
          { assignedTo: userId },
          { user: userId }
        ];
      } else {
        // Regular users see only their tickets
        filter.user = userId;
      }
    }

    // Additional filters from query params
    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.priority) {
      filter.priority = req.query.priority;
    }

    if (req.query.category) {
      filter.category = req.query.category;
    }

    // Search by title
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const tickets = await Ticket.find(filter)
      .populate('user', 'username email phone')
      .populate('assignedTo', 'username email phone role')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination info
    const total = await Ticket.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: tickets.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      tickets
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tickets',
      error: error.message
    });
  }
};

// Get ticket by ID
const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.payload?.id;
    const userRole = req.user?.payload?.role;
    const isAdmin = req.user?.payload?.isAdmin || userRole === 'ADMIN';
    const isSupport = userRole === 'SUPPORT';
    const isAgent = userRole === 'AGENT';

    const ticket = await Ticket.findById(id)
      .populate('user', 'username email phone address')
      .populate('assignedTo', 'username email phone role')
      .populate('messages.sender', 'username email role');

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check permissions - only allow access to own tickets unless admin/support/assigned
    const isTicketOwner = ticket.user._id.toString() === userId;
    const isAssigned = ticket.assignedTo && ticket.assignedTo._id.toString() === userId;

    if (!isAdmin && !isSupport && !isTicketOwner && !isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own tickets or tickets assigned to you'
      });
    }

    res.status(200).json({
      success: true,
      ticket
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ticket',
      error: error.message
    });
  }
};

// Create new ticket
const createTicket = async (req, res) => {
  try {
    const {
      title, description, category, priority, relatedService
    } = req.body;

    const userId = req.user.payload.id;

    // Validate that user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Create ticket
    const newTicket = new Ticket({
      title,
      description,
      category,
      priority: priority || 'MEDIUM',
      status: 'OPEN',
      user: userId,
      relatedService: relatedService || {},
      messages: [{
        sender: userId,
        content: description,
        timestamp: Date.now()
      }]
    });

    const savedTicket = await newTicket.save();

    // Populate the response data
    const populatedTicket = await Ticket.findById(savedTicket._id)
      .populate('user', 'username email phone')
      .populate('messages.sender', 'username email role');

    // Send ticket confirmation to user
    await EmailService.sendTicketConfirmation(populatedTicket, user);
    await EmailService.notifyNewTicket(populatedTicket, user);

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      ticket: populatedTicket
    });
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create ticket',
      error: error.message
    });
  }
};

// Update ticket
const updateTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, priority, status } = req.body;
    const userId = req.user.payload.id;
    const userRole = req.user.payload.role;
    const isAdmin = req.user.payload.isAdmin || userRole === 'ADMIN';
    const isSupport = userRole === 'SUPPORT';
    const isAgent = userRole === 'AGENT';

    // Find the ticket
    const ticket = await Ticket.findById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check if user has permission to update
    const isTicketOwner = ticket.user.toString() === userId;
    const isAssigned = ticket.assignedTo && ticket.assignedTo.toString() === userId;

    if (!isAdmin && !isSupport && !isTicketOwner && !isAssigned) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this ticket'
      });
    }

    // Define allowed fields based on role
    const updates = {};

    // Ticket owner can update title, description, priority (if status is OPEN)
    if (isTicketOwner && ticket.status === 'OPEN') {
      if (title) updates.title = title;
      if (description) updates.description = description;
      if (priority) updates.priority = priority;
    }

    // Support/admin/agent can update all fields
    if (isAdmin || isSupport || (isAgent && isAssigned)) {
      if (title) updates.title = title;
      if (description) updates.description = description;
      if (category) updates.category = category;
      if (priority) updates.priority = priority;
      if (status) updates.status = status;
    }

    // Add updated_at timestamp
    updates.updated_at = Date.now();

    // Update the ticket
    const updatedTicket = await Ticket.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    )
      .populate('user', 'username email phone')
      .populate('assignedTo', 'username email phone role')
      .populate('messages.sender', 'username email role');

    const sender = await User.findById(userId);

    // Notify ticket owner about new message (if sender is not the owner)
    const ticketOwner = await User.findById(updatedTicket.user);
    if (ticketOwner && !isTicketOwner) {
      await EmailService.notifyNewTicketMessage(updatedTicket, ticketOwner, newMessage, sender);
    }

    // Notify assigned staff member about new message (if sender is not the assigned staff)
    if (updatedTicket.assignedTo && !isAssigned) {
      const assignedStaff = await User.findById(updatedTicket.assignedTo);
      if (assignedStaff) {
        await EmailService.notifyStaffNewTicketMessage(updatedTicket, assignedStaff, newMessage, sender);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Ticket updated successfully',
      ticket: updatedTicket
    });
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ticket',
      error: error.message
    });
  }
};

// Delete ticket (only for admins)
const deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.payload.id;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';

    // Only admins can delete tickets
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete tickets'
      });
    }

    // Find and delete the ticket
    const deletedTicket = await Ticket.findByIdAndDelete(id);

    if (!deletedTicket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Ticket deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete ticket',
      error: error.message
    });
  }
};

// Get user's tickets
const getUserTickets = async (req, res) => {
  try {
    const userId = req.user.payload.id;

    // Get tickets where user is the ticket creator
    const tickets = await Ticket.find({ user: userId })
      .populate('user', 'username email phone')
      .populate('assignedTo', 'username email phone role')
      .sort({ created_at: -1 });

    res.status(200).json({
      success: true,
      count: tickets.length,
      tickets
    });
  } catch (error) {
    console.error('Error fetching user tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user tickets',
      error: error.message
    });
  }
};

// Get assigned tickets (for support/admin/agent)
const getAssignedTickets = async (req, res) => {
  try {
    const userId = req.user.payload.id;
    const userRole = req.user.payload.role;
    const isAdmin = req.user.payload.isAdmin || userRole === 'ADMIN';
    const isSupport = userRole === 'SUPPORT';
    const isAgent = userRole === 'AGENT';

    if (!isAdmin && !isSupport && !isAgent) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only support staff and admins can access this endpoint'
      });
    }

    // Get tickets assigned to this user
    const tickets = await Ticket.find({ assignedTo: userId })
      .populate('user', 'username email phone')
      .populate('assignedTo', 'username email phone role')
      .sort({ created_at: -1 });

    res.status(200).json({
      success: true,
      count: tickets.length,
      tickets
    });
  } catch (error) {
    console.error('Error fetching assigned tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assigned tickets',
      error: error.message
    });
  }
};

// Assign ticket to staff member (for admins and support)
const assignTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { assigneeId } = req.body;
    const userId = req.user.payload.id;
    const userRole = req.user.payload.role;
    const isAdmin = req.user.payload.isAdmin || userRole === 'ADMIN';
    const isSupport = userRole === 'SUPPORT';

    // Only admins and support can assign tickets
    if (!isAdmin && !isSupport) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators and support staff can assign tickets'
      });
    }

    // Find the ticket
    const ticket = await Ticket.findById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check if assignee exists and has appropriate role
    let assigneeDetails = null;
    if (assigneeId) {
      assigneeDetails = await User.findById(assigneeId);

      if (!assigneeDetails) {
        return res.status(404).json({
          success: false,
          message: 'Assignee not found'
        });
      }

      if (assigneeDetails.role !== 'SUPPORT' && assigneeDetails.role !== 'ADMIN' && assigneeDetails.role !== 'AGENT') {
        return res.status(400).json({
          success: false,
          message: 'Assignee must be a support staff, agent, or admin'
        });
      }
    }

    // Update the ticket with new assignee (or remove if assigneeId is null)
    const updatedTicket = await Ticket.findByIdAndUpdate(
      id,
      {
        assignedTo: assigneeId || null,
        updated_at: Date.now(),
        status: assigneeId ? 'IN_PROGRESS' : 'OPEN' // Change status to IN_PROGRESS if assigned
      },
      { new: true, runValidators: true }
    )
      .populate('user', 'username email phone')
      .populate('assignedTo', 'username email phone role')
      .populate('messages.sender', 'username email role');

    // Add system message noting the assignment change
    const systemMessage = {
      sender: userId,
      content: assigneeId
        ? `Ticket assigned to ${assigneeDetails.username || 'staff member'}`
        : 'Ticket unassigned',
      timestamp: Date.now()
    };

    updatedTicket.messages.push(systemMessage);
    await updatedTicket.save();

    const ticketOwner = await User.findById(updatedTicket.user);
    if (ticketOwner && assigneeId) {
      await EmailService.notifyTicketAssignment(updatedTicket, ticketOwner, assigneeDetails);
    }

    // Notify assigned staff member
    if (assigneeId) {
      await EmailService.notifyStaffTicketAssignment(updatedTicket, assigneeDetails);
    }

    res.status(200).json({
      success: true,
      message: assigneeId ? 'Ticket assigned successfully' : 'Ticket unassigned successfully',
      ticket: updatedTicket
    });
  } catch (error) {
    console.error('Error assigning ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign ticket',
      error: error.message
    });
  }
};

// Change ticket status
const changeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.payload.id;
    const userRole = req.user.payload.role;
    const isAdmin = req.user.payload.isAdmin || userRole === 'ADMIN';
    const isSupport = userRole === 'SUPPORT';
    const isAgent = userRole === 'AGENT';

    // Check if status is valid
    const validStatuses = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Find the ticket
    const ticket = await Ticket.findById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check if user has permission to update status
    const isTicketOwner = ticket.user.toString() === userId;
    const isAssigned = ticket.assignedTo && ticket.assignedTo.toString() === userId;

    // Owners can only close tickets, staff can change any status
    if (!isAdmin && !isSupport && !isAssigned) {
      if (!(isTicketOwner && status === 'CLOSED')) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update this ticket status'
        });
      }
    }

    // Update the ticket status
    const updatedTicket = await Ticket.findByIdAndUpdate(
      id,
      { status, updated_at: Date.now() },
      { new: true, runValidators: true }
    )
      .populate('user', 'username email phone')
      .populate('assignedTo', 'username email phone role')
      .populate('messages.sender', 'username email role');

    // Add system message noting the status change
    const systemMessage = {
      sender: userId,
      content: `Ticket status changed to ${status}`,
      timestamp: Date.now()
    };

    updatedTicket.messages.push(systemMessage);
    await updatedTicket.save();

    const ticketOwner = await User.findById(updatedTicket.user);
    if (ticketOwner) {
      await EmailService.notifyTicketStatusChange(updatedTicket, ticketOwner, previousStatus);
    }

    res.status(200).json({
      success: true,
      message: 'Ticket status updated successfully',
      ticket: updatedTicket
    });
  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ticket status',
      error: error.message
    });
  }
};

// Add message to ticket
const addMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, attachments } = req.body;
    const userId = req.user.payload.id;

    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Find the ticket
    const ticket = await Ticket.findById(id);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check if user has permission to add message
    const isTicketOwner = ticket.user.toString() === userId;
    const isAssigned = ticket.assignedTo && ticket.assignedTo.toString() === userId;
    const isStaff = req.user.payload.role === 'ADMIN' ||
      req.user.payload.role === 'SUPPORT' ||
      req.user.payload.isAdmin;

    if (!isTicketOwner && !isAssigned && !isStaff) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to add messages to this ticket'
      });
    }

    // Add the message
    const newMessage = {
      sender: userId,
      content,
      attachments: attachments || [],
      timestamp: Date.now()
    };

    ticket.messages.push(newMessage);

    // Update status based on who's sending the message
    if (isTicketOwner && ticket.status === 'WAITING_CUSTOMER') {
      ticket.status = 'IN_PROGRESS';
    } else if ((isAssigned || isStaff) && ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED') {
      ticket.status = 'WAITING_CUSTOMER';
    }

    ticket.updated_at = Date.now();

    await ticket.save();

    // Populate the sender details in the new message
    const updatedTicket = await Ticket.findById(id)
      .populate('user', 'username email phone')
      .populate('assignedTo', 'username email phone role')
      .populate('messages.sender', 'username email role');

    res.status(200).json({
      success: true,
      message: 'Message added successfully',
      ticket: updatedTicket
    });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add message',
      error: error.message
    });
  }
};

// Get tickets by category
const getTicketsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const userId = req.user.payload.id;
    const userRole = req.user.payload.role;
    const isAdmin = req.user.payload.isAdmin || userRole === 'ADMIN';
    const isSupport = userRole === 'SUPPORT';
    const isAgent = userRole === 'AGENT';

    // Build filter based on role
    const filter = { category };

    if (!isAdmin && !isSupport) {
      if (isAgent) {
        // Agents see tickets assigned to them or with no assignee
        filter.$or = [
          { assignedTo: userId },
          { user: userId }
        ];
      } else {
        // Regular users see only their tickets
        filter.user = userId;
      }
    }

    // Get tickets by category with appropriate filtering
    const tickets = await Ticket.find(filter)
      .populate('user', 'username email phone')
      .populate('assignedTo', 'username email phone role')
      .sort({ updated_at: -1 });

    res.status(200).json({
      success: true,
      count: tickets.length,
      tickets
    });
  } catch (error) {
    console.error('Error fetching tickets by category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tickets',
      error: error.message
    });
  }
};

// Get tickets by priority
const getTicketsByPriority = async (req, res) => {
  try {
    const { priority } = req.params;
    const userId = req.user.payload.id;
    const userRole = req.user.payload.role;
    const isAdmin = req.user.payload.isAdmin || userRole === 'ADMIN';
    const isSupport = userRole === 'SUPPORT';
    const isAgent = userRole === 'AGENT';

    // Build filter based on role
    const filter = { priority };

    if (!isAdmin && !isSupport) {
      if (isAgent) {
        filter.$or = [
          { assignedTo: userId },
          { user: userId }
        ];
      } else {
        filter.user = userId;
      }
    }

    // Get tickets by priority with appropriate filtering
    const tickets = await Ticket.find(filter)
      .populate('user', 'username email phone')
      .populate('assignedTo', 'username email phone role')
      .sort({ updated_at: -1 });

    res.status(200).json({
      success: true,
      count: tickets.length,
      tickets
    });
  } catch (error) {
    console.error('Error fetching tickets by priority:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tickets',
      error: error.message
    });
  }
};

// Get tickets statistics (for admin dashboard)
const getTicketsStatistics = async (req, res) => {
  try {
    const userId = req.user.payload.id;
    const userRole = req.user.payload.role;
    const isAdmin = req.user.payload.isAdmin || userRole === 'ADMIN';
    const isSupport = userRole === 'SUPPORT';

    // Only admins and support can access statistics
    if (!isAdmin && !isSupport) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only administrators and support staff can access statistics'
      });
    }

    // Get counts by status
    const statusStats = await Ticket.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    // Get counts by category
    const categoryStats = await Ticket.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } }
    ]);

    // Get counts by priority
    const priorityStats = await Ticket.aggregate([
      { $group: { _id: "$priority", count: { $sum: 1 } } }
    ]);

    // Get recent tickets
    const recentTickets = await Ticket.find()
      .sort({ created_at: -1 })
      .limit(5)
      .populate('user', 'username email')
      .populate('assignedTo', 'username email');

    // Get unassigned tickets count
    const unassignedCount = await Ticket.countDocuments({
      assignedTo: { $exists: false }
    });

    // Format the statistics
    const statistics = {
      byStatus: statusStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      byCategory: categoryStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      byPriority: priorityStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      totalTickets: await Ticket.countDocuments(),
      unassignedTickets: unassignedCount,
      recentTickets
    };

    res.status(200).json({
      success: true,
      statistics
    });
  } catch (error) {
    console.error('Error fetching ticket statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ticket statistics',
      error: error.message
    });
  }
};

module.exports = {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket,
  deleteTicket,
  getUserTickets,
  getAssignedTickets,
  assignTicket,
  changeStatus,
  addMessage,
  getTicketsByCategory,
  getTicketsByPriority,
  getTicketsStatistics,
};