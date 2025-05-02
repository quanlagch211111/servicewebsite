const Appointment = require('../models/Appointment');
const User = require('../models/User');
const RealEstate = require('../models/RealEstate');
const Insurance = require('../models/Insurance');
const Visa = require('../models/Visa');
const Tax = require('../models/Tax');
const EmailService = require('../services/EmailService');

// Get all appointments with pagination and filtering
const getAllAppointments = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Filter based on user role
    const userId = req.user.payload.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Base filter
    let filter = {};

    // Regular users can only see their appointments
    if (user.role !== 'ADMIN' && user.role !== 'AGENT' && user.role !== 'SUPPORT') {
      filter.client = userId;
    } 
    // Staff can see appointments they're assigned to
    else if (user.role === 'AGENT' || user.role === 'SUPPORT') {
      filter = {
        $or: [
          { staff: userId },
          { client: userId }
        ]
      };
    }
    // Admins can see all appointments

    // Additional filters
    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.serviceType) {
      filter.serviceType = req.query.serviceType;
    }

    if (req.query.startDate && req.query.endDate) {
      filter.startTime = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    } else if (req.query.startDate) {
      filter.startTime = { $gte: new Date(req.query.startDate) };
    } else if (req.query.endDate) {
      filter.startTime = { $lte: new Date(req.query.endDate) };
    }

    // Get appointments with pagination
    const appointments = await Appointment.find(filter)
      .populate('client', 'username email phone')
      .populate('staff', 'username email phone')
      .sort({ startTime: 1 })
      .skip(skip)
      .limit(limit);

    // Get total appointments count
    const total = await Appointment.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: appointments.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      appointments
    });
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointments',
      error: error.message
    });
  }
};

// Get appointment by ID
const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.payload.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const appointment = await Appointment.findById(id)
      .populate('client', 'username email phone')
      .populate('staff', 'username email phone');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check permissions - only client, assigned staff, or admin can view details
    const isAdmin = user.role === 'ADMIN';
    const isClient = appointment.client._id.toString() === userId;
    const isAssignedStaff = appointment.staff._id.toString() === userId;
    
    if (!isAdmin && !isClient && !isAssignedStaff) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this appointment'
      });
    }

    res.status(200).json({
      success: true,
      appointment
    });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointment details',
      error: error.message
    });
  }
};

// Request new appointment
const requestAppointment = async (req, res) => {
  try {
    const {
      title,
      description,
      startTime,
      endTime,
      serviceType,
      serviceId,
      location
    } = req.body;

    const clientId = req.user.payload.id;
    let staffId = null;

    // Determine who to assign the appointment to based on service type and ID
    if (serviceId) {
      switch (serviceType) {
        case 'REAL_ESTATE':
          const property = await RealEstate.findById(serviceId);
          if (!property) {
            return res.status(404).json({
              success: false,
              message: 'Property not found'
            });
          }
          // Assign to agent if available, otherwise to owner
          staffId = property.agent || property.owner;
          break;
        
        case 'INSURANCE':
          const policy = await Insurance.findById(serviceId);
          if (!policy) {
            return res.status(404).json({
              success: false,
              message: 'Insurance policy not found'
            });
          }
          // Assign to agent if available, otherwise to admin
          staffId = policy.agent;
          break;
        
        case 'VISA':
          const visa = await Visa.findById(serviceId);
          if (!visa) {
            return res.status(404).json({
              success: false,
              message: 'Visa application not found'
            });
          }
          // Assign to agent if available, otherwise to admin
          staffId = visa.agent;
          break;
        
        case 'TAX':
          const tax = await Tax.findById(serviceId);
          if (!tax) {
            return res.status(404).json({
              success: false,
              message: 'Tax case not found'
            });
          }
          // Assign to tax professional if available, otherwise to admin
          staffId = tax.taxProfessional;
          break;
        
        case 'OTHER':
          // For general appointments, assign to admin
          break;
      }
    }

    // If no staff was determined, assign to an admin
    if (!staffId) {
      const admin = await User.findOne({ role: 'ADMIN' });
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: 'No admin user found to assign appointment'
        });
      }
      staffId = admin._id;
    }

    // Create the appointment
    const newAppointment = new Appointment({
      title,
      description,
      startTime,
      endTime,
      serviceType,
      serviceId,
      client: clientId,
      staff: staffId,
      location,
      status: 'SCHEDULED',
      reminders: [
        { time: new Date(new Date(startTime).getTime() - 24 * 60 * 60 * 1000), sent: false }, // 1 day before
        { time: new Date(new Date(startTime).getTime() - 1 * 60 * 60 * 1000), sent: false }   // 1 hour before
      ]
    });

    const savedAppointment = await newAppointment.save();

    // Populate client and staff information for email notifications
    const populatedAppointment = await Appointment.findById(savedAppointment._id)
      .populate('client', 'username email phone')
      .populate('staff', 'username email phone');

    // Send email notifications
    try {
      // Notify client
      await EmailService.sendAppointmentConfirmation(populatedAppointment, populatedAppointment.client);
      
      // Notify staff
      await EmailService.notifyStaffNewAppointment(populatedAppointment, populatedAppointment.staff);
    } catch (emailError) {
      console.error('Error sending email notifications:', emailError);
      // Continue even if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Appointment requested successfully',
      appointment: populatedAppointment
    });
  } catch (error) {
    console.error('Error requesting appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request appointment',
      error: error.message
    });
  }
};

// Update appointment (staff or admin only)
const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.payload.id;
    
    // Find the appointment
    const appointment = await Appointment.findById(id);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check permissions
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isAdmin = user.role === 'ADMIN';
    const isAssignedStaff = appointment.staff.toString() === userId;
    
    if (!isAdmin && !isAssignedStaff) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this appointment'
      });
    }

    // Store previous status to check if it changed
    const previousStatus = appointment.status;

    // Update fields
    const allowedUpdates = [
      'title', 'description', 'startTime', 'endTime', 
      'location', 'status', 'reminders'
    ];
    
    // Admin can also reassign staff
    if (isAdmin) {
      allowedUpdates.push('staff');
    }

    // Filter updates to only allowed fields
    const filteredUpdates = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    // Add updated_at timestamp
    filteredUpdates.updated_at = Date.now();

    // Update the appointment
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      id,
      filteredUpdates,
      { new: true, runValidators: true }
    ).populate('client', 'username email phone')
      .populate('staff', 'username email phone');

    // Send notifications if status changed
    if (previousStatus !== updatedAppointment.status) {
      try {
        await EmailService.notifyAppointmentStatusChange(
          updatedAppointment,
          updatedAppointment.client,
          previousStatus
        );
      } catch (emailError) {
        console.error('Error sending status change notification:', emailError);
        // Continue even if email fails
      }
    }

    res.status(200).json({
      success: true,
      message: 'Appointment updated successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update appointment',
      error: error.message
    });
  }
};

// Cancel appointment (can be done by client, assigned staff, or admin)
const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.payload.id;
    
    // Find the appointment
    const appointment = await Appointment.findById(id)
      .populate('client', 'username email phone')
      .populate('staff', 'username email phone');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check permissions
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';
    const isClient = appointment.client._id.toString() === userId;
    const isAssignedStaff = appointment.staff._id.toString() === userId;
    
    if (!isAdmin && !isClient && !isAssignedStaff) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to cancel this appointment'
      });
    }

    // Only allow cancellation if status is SCHEDULED or RESCHEDULED
    if (!['SCHEDULED', 'RESCHEDULED'].includes(appointment.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel appointment in ${appointment.status} status`
      });
    }

    // Store previous status
    const previousStatus = appointment.status;

    // Update status to CANCELLED
    appointment.status = 'CANCELLED';
    appointment.description += reason ? `\n\nCancellation reason: ${reason}` : '';
    appointment.updated_at = Date.now();
    
    await appointment.save();

    // Send cancellation notifications
    try {
      // Notify client (if staff cancelled)
      if (!isClient) {
        await EmailService.notifyAppointmentStatusChange(
          appointment,
          appointment.client,
          previousStatus
        );
      }
      
      // Notify staff (if client cancelled)
      if (!isAssignedStaff) {
        await EmailService.notifyStaffAppointmentCancelled(
          appointment,
          appointment.staff,
          reason
        );
      }
    } catch (emailError) {
      console.error('Error sending cancellation notifications:', emailError);
      // Continue even if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Appointment cancelled successfully',
      appointment
    });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel appointment',
      error: error.message
    });
  }
};

// Get user's appointments (client or staff)
const getUserAppointments = async (req, res) => {
  try {
    const userId = req.user.payload.id;
    
    // Filter based on role
    const filter = {
      $or: [
        { client: userId },
        { staff: userId }
      ]
    };

    // Additional filters
    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.serviceType) {
      filter.serviceType = req.query.serviceType;
    }

    // Get future appointments by default
    if (!req.query.includeOld) {
      filter.startTime = { $gte: new Date() };
    }

    const appointments = await Appointment.find(filter)
      .populate('client', 'username email phone')
      .populate('staff', 'username email phone')
      .sort({ startTime: 1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      appointments
    });
  } catch (error) {
    console.error('Error fetching user appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user appointments',
      error: error.message
    });
  }
};

// Get staff appointments (for assigned staff only)
const getStaffAppointments = async (req, res) => {
  try {
    const userId = req.user.payload.id;
    
    // Get only appointments where user is staff
    const filter = { staff: userId };

    // Additional filters
    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.serviceType) {
      filter.serviceType = req.query.serviceType;
    }

    // Get future appointments by default
    if (!req.query.includeOld) {
      filter.startTime = { $gte: new Date() };
    }

    const appointments = await Appointment.find(filter)
      .populate('client', 'username email phone')
      .populate('staff', 'username email phone')
      .sort({ startTime: 1 });

    res.status(200).json({
      success: true,
      count: appointments.length,
      appointments
    });
  } catch (error) {
    console.error('Error fetching staff appointments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch staff appointments',
      error: error.message
    });
  }
};

// Reassign appointment to different staff (admin only)
const reassignAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { staffId } = req.body;
    
    // Only admin can reassign
    if (!req.user.payload.isAdmin && req.user.payload.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only admin can reassign appointments'
      });
    }

    // Check if new staff exists
    const newStaff = await User.findById(staffId);
    if (!newStaff) {
      return res.status(404).json({
        success: false,
        message: 'Staff user not found'
      });
    }

    // Find the appointment
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Store previous staff
    const previousStaffId = appointment.staff;

    // Update staff
    appointment.staff = staffId;
    appointment.updated_at = Date.now();
    
    await appointment.save();

    const updatedAppointment = await Appointment.findById(id)
      .populate('client', 'username email phone')
      .populate('staff', 'username email phone');

    // Send notifications
    try {
      // Notify new staff
      await EmailService.notifyStaffNewAppointment(
        updatedAppointment,
        updatedAppointment.staff
      );
      
      // Notify previous staff if different
      if (previousStaffId.toString() !== staffId.toString()) {
        const previousStaff = await User.findById(previousStaffId);
        if (previousStaff) {
          await EmailService.notifyStaffAppointmentReassigned(
            updatedAppointment,
            previousStaff,
            updatedAppointment.staff
          );
        }
      }
      
      // Notify client about reassignment
      await EmailService.notifyClientAppointmentReassigned(
        updatedAppointment,
        updatedAppointment.client,
        updatedAppointment.staff
      );
    } catch (emailError) {
      console.error('Error sending reassignment notifications:', emailError);
      // Continue even if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Appointment reassigned successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('Error reassigning appointment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reassign appointment',
      error: error.message
    });
  }
};

// Change appointment status (staff or admin only)
const changeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const userId = req.user.payload.id;
    
    // Check if status is valid
    const validStatuses = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Find the appointment
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check permissions
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isAdmin = user.role === 'ADMIN';
    const isAssignedStaff = appointment.staff.toString() === userId;
    
    if (!isAdmin && !isAssignedStaff) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to change this appointment status'
      });
    }

    // Don't allow changing from CANCELLED to other statuses
    if (appointment.status === 'CANCELLED' && status !== 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change status from CANCELLED'
      });
    }

    // Store previous status
    const previousStatus = appointment.status;

    // Update status
    appointment.status = status;
    
    // Add notes if provided
    if (notes) {
      appointment.description += `\n\nStatus change notes: ${notes}`;
    }
    
    appointment.updated_at = Date.now();
    
    await appointment.save();

    const updatedAppointment = await Appointment.findById(id)
      .populate('client', 'username email phone')
      .populate('staff', 'username email phone');

    // Send status change notification
    try {
      await EmailService.notifyAppointmentStatusChange(
        updatedAppointment,
        updatedAppointment.client,
        previousStatus,
        notes
      );
    } catch (emailError) {
      console.error('Error sending status change notification:', emailError);
      // Continue even if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Appointment status updated successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('Error changing appointment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change appointment status',
      error: error.message
    });
  }
};

// Add this method
const getAppointmentStatistics = async (req, res) => {
  try {
    // Get total appointments
    const total = await Appointment.countDocuments();
    
    // Get counts by status
    const scheduled = await Appointment.countDocuments({ status: 'SCHEDULED' });
    const completed = await Appointment.countDocuments({ status: 'COMPLETED' });
    const cancelled = await Appointment.countDocuments({ status: 'CANCELLED' });
    
    res.status(200).json({
      success: true,
      stats: {
        total,
        scheduled,
        completed,
        cancelled
      }
    });
  } catch (error) {
    console.error('Error getting appointment statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appointment statistics',
      error: error.message
    });
  }
};


module.exports = {
  getAllAppointments,
  getAppointmentById,
  requestAppointment,
  updateAppointment,
  cancelAppointment,
  getUserAppointments,
  getStaffAppointments,
  reassignAppointment,
  changeStatus,
  getAppointmentStatistics
};