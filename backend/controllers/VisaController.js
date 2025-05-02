const Visa = require('../models/Visa');
const User = require('../models/User');
const EmailService = require('../services/EmailService');

// Get all visa applications with pagination and filtering
const getAllVisaApplications = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Basic filtering options
    const filter = {};

    // Admins and agents can see all, users can only see their own
    const userId = req.user?.payload?.id;
    const isAdmin = req.user?.payload?.isAdmin || req.user?.payload?.role === 'ADMIN';
    const isAgent = req.user?.payload?.role === 'AGENT';

    if (!isAdmin && !isAgent) {
      filter.applicant = userId;
    }

    // Additional filters from query params
    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.destination) {
      filter.destination = { $regex: req.query.destination, $options: 'i' };
    }

    // Execute query with pagination
    const visaApplications = await Visa.find(filter)
      .populate('applicant', 'username email phone')
      .populate('agent', 'username email phone')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination info
    const total = await Visa.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: visaApplications.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      visaApplications
    });
  } catch (error) {
    console.error('Error fetching visa applications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch visa applications',
      error: error.message
    });
  }
};

// Get visa application by ID
const getVisaApplicationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.payload?.id;
    const isAdmin = req.user?.payload?.isAdmin || req.user?.payload?.role === 'ADMIN';
    const isAgent = req.user?.payload?.role === 'AGENT';

    const visaApplication = await Visa.findById(id)
      .populate('applicant', 'username email phone address')
      .populate('agent', 'username email phone');

    if (!visaApplication) {
      return res.status(404).json({
        success: false,
        message: 'Visa application not found'
      });
    }

    // Check permissions - only allow access to own applications unless admin/agent
    if (!isAdmin && !isAgent && visaApplication.applicant._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own visa applications'
      });
    }

    res.status(200).json({
      success: true,
      visaApplication
    });
  } catch (error) {
    console.error('Error fetching visa application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch visa application',
      error: error.message
    });
  }
};

// Create new visa application
const createVisaApplication = async (req, res) => {
  try {
    const {
      type, destination, purpose, applicationDetails, applicantUserId, documents, notes
    } = req.body;

    // Default to current user if applicantUserId not provided or not admin/agent
    const creatorId = req.user.payload.id;
    const creatorRole = req.user.payload.role;
    const isAdmin = req.user.payload.isAdmin || creatorRole === 'ADMIN';
    const isAgent = creatorRole === 'AGENT';

    // Determine applicant
    let applicantId = creatorId;

    // If admin or agent is creating for someone else
    if ((isAdmin || isAgent) && applicantUserId) {
      // Check if the specified applicant exists
      const applicantExists = await User.findById(applicantUserId);
      if (!applicantExists) {
        return res.status(404).json({
          success: false,
          message: 'Specified applicant user not found'
        });
      }
      applicantId = applicantUserId;
    }

    // Create visa application
    const newVisaApplication = new Visa({
      type,
      applicant: applicantId,
      destination,
      purpose,
      applicationDetails,
      status: 'SUBMITTED',
      documents: documents || [],
      notes: notes || '',
      agent: (isAdmin || isAgent) ? creatorId : undefined
    });

    const savedVisaApplication = await newVisaApplication.save();

    // Populate the response data
    const populatedVisaApplication = await Visa.findById(savedVisaApplication._id)
      .populate('applicant', 'username email phone')
      .populate('agent', 'username email phone');

    const applicant = await User.findById(applicantId);

    // Send confirmation to applicant
    await EmailService.sendVisaApplicationConfirmation(populatedVisaApplication, applicant);

    // Notify admins and agents
    await EmailService.notifyNewVisaApplication(populatedVisaApplication, applicant);


    res.status(201).json({
      success: true,
      message: 'Visa application created successfully',
      visaApplication: populatedVisaApplication
    });
  } catch (error) {
    console.error('Error creating visa application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create visa application',
      error: error.message
    });
  }
};

// Update visa application
const updateVisaApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.payload.id;
    const userRole = req.user.payload.role;
    const isAdmin = req.user.payload.isAdmin || userRole === 'ADMIN';
    const isAgent = userRole === 'AGENT';

    // Find the visa application
    const visaApplication = await Visa.findById(id);

    if (!visaApplication) {
      return res.status(404).json({
        success: false,
        message: 'Visa application not found'
      });
    }

    // Check if user has permission to update
    const isApplicant = visaApplication.applicant.toString() === userId;
    const isAssignedAgent = visaApplication.agent && visaApplication.agent.toString() === userId;

    if (!isApplicant && !isAssignedAgent && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this visa application'
      });
    }

    // Define allowed fields based on role
    let allowedUpdates = [];

    if (isAdmin || isAgent) {
      // Admins and agents can update all fields
      allowedUpdates = [
        'type', 'destination', 'purpose', 'applicationDetails',
        'status', 'documents', 'notes', 'agent'
      ];
    } else if (isApplicant) {
      // Application status affects which fields an applicant can update
      if (visaApplication.status === 'SUBMITTED' || visaApplication.status === 'ADDITIONAL_INFO_REQUIRED') {
        allowedUpdates = ['purpose', 'documents', 'notes'];

        // Only allow updating application details if ADDITIONAL_INFO_REQUIRED
        if (visaApplication.status === 'ADDITIONAL_INFO_REQUIRED') {
          allowedUpdates.push('applicationDetails');
        }
      } else {
        return res.status(403).json({
          success: false,
          message: `You cannot update a visa application in '${visaApplication.status}' status`
        });
      }
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

    // Update the visa application
    const updatedVisaApplication = await Visa.findByIdAndUpdate(
      id,
      filteredUpdates,
      { new: true, runValidators: true }
    ).populate('applicant', 'username email phone')
      .populate('agent', 'username email phone');

    res.status(200).json({
      success: true,
      message: 'Visa application updated successfully',
      visaApplication: updatedVisaApplication
    });
  } catch (error) {
    console.error('Error updating visa application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update visa application',
      error: error.message
    });
  }
};

// Delete visa application
const deleteVisaApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.payload.id;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';

    // Find the visa application
    const visaApplication = await Visa.findById(id);

    if (!visaApplication) {
      return res.status(404).json({
        success: false,
        message: 'Visa application not found'
      });
    }

    // Check if user has permission to delete
    // Only admin or the applicant themselves (if application is still in SUBMITTED status)
    const isApplicant = visaApplication.applicant.toString() === userId;
    const isDeletable = visaApplication.status === 'SUBMITTED';

    if (!isAdmin && (!isApplicant || !isDeletable)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this visa application'
      });
    }

    // Delete the visa application
    await Visa.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Visa application deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting visa application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete visa application',
      error: error.message
    });
  }
};

// Get user's visa applications
const getUserVisaApplications = async (req, res) => {
  try {
    const userId = req.user.payload.id;

    // Get applications where user is applicant
    const visaApplications = await Visa.find({ applicant: userId })
      .populate('applicant', 'username email phone')
      .populate('agent', 'username email phone')
      .sort({ created_at: -1 });

    res.status(200).json({
      success: true,
      count: visaApplications.length,
      visaApplications
    });
  } catch (error) {
    console.error('Error fetching user visa applications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user visa applications',
      error: error.message
    });
  }
};

// Get agent's assigned visa applications
const getAgentVisaApplications = async (req, res) => {
  try {
    const userId = req.user.payload.id;
    const userRole = req.user.payload.role;
    const isAdmin = req.user.payload.isAdmin || userRole === 'ADMIN';
    const isAgent = userRole === 'AGENT';

    if (!isAdmin && !isAgent) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only agents and admins can access this endpoint'
      });
    }

    // Get applications where user is the assigned agent
    const visaApplications = await Visa.find({ agent: userId })
      .populate('applicant', 'username email phone')
      .populate('agent', 'username email phone')
      .sort({ created_at: -1 });

    res.status(200).json({
      success: true,
      count: visaApplications.length,
      visaApplications
    });
  } catch (error) {
    console.error('Error fetching agent visa applications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agent visa applications',
      error: error.message
    });
  }
};

// Assign agent to visa application (for Admins)
const assignAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body;
    const userId = req.user.payload.id;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';

    // Only admins can assign agents
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can assign agents to visa applications'
      });
    }

    // Find the visa application
    const visaApplication = await Visa.findById(id);

    if (!visaApplication) {
      return res.status(404).json({
        success: false,
        message: 'Visa application not found'
      });
    }

    // Check if agent exists and has appropriate role
    if (agentId) {
      const agent = await User.findById(agentId);

      if (!agent) {
        return res.status(404).json({
          success: false,
          message: 'Agent not found'
        });
      }

      if (agent.role !== 'AGENT' && agent.role !== 'ADMIN') {
        return res.status(400).json({
          success: false,
          message: 'Assigned user must be an agent or admin'
        });
      }
    }

    // Update the visa application with new agent (or remove if agentId is null)
    const updatedVisaApplication = await Visa.findByIdAndUpdate(
      id,
      { agent: agentId || null, updated_at: Date.now() },
      { new: true, runValidators: true }
    ).populate('applicant', 'username email phone')
      .populate('agent', 'username email phone');

    if (agentId) {
      const agent = await User.findById(agentId);
      if (agent) {
        await EmailService.notifyAgentVisaAssignment(updatedVisaApplication, agent);
      }
    }
    res.status(200).json({
      success: true,
      message: agentId ? 'Agent assigned successfully' : 'Agent removed successfully',
      visaApplication: updatedVisaApplication
    });
  } catch (error) {
    console.error('Error assigning agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign agent',
      error: error.message
    });
  }
};

// Change visa application status
// Change visa application status
const changeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const userId = req.user.payload.id;
    const userRole = req.user.payload.role;
    const isAdmin = req.user.payload.isAdmin || userRole === 'ADMIN';
    const isAgent = userRole === 'AGENT';

    // Check if status is valid
    const validStatuses = ['SUBMITTED', 'PROCESSING', 'APPROVED', 'REJECTED', 'ADDITIONAL_INFO_REQUIRED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Find the visa application
    const visaApplication = await Visa.findById(id);

    if (!visaApplication) {
      return res.status(404).json({
        success: false,
        message: 'Visa application not found'
      });
    }

    // Store previous status for notification
    const previousStatus = visaApplication.status;

    // Check if user has permission to update status
    const isAssignedAgent = visaApplication.agent && visaApplication.agent.toString() === userId;

    if (!isAssignedAgent && !isAdmin && !isAgent) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this visa application status'
      });
    }

    // Update the visa application status and add notes if provided
    const updateData = {
      status,
      updated_at: Date.now()
    };

    if (notes) {
      updateData.notes = visaApplication.notes
        ? `${visaApplication.notes}\n\n${new Date().toISOString()}: ${notes}`
        : `${new Date().toISOString()}: ${notes}`;
    }

    const updatedVisaApplication = await Visa.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('applicant', 'username email phone')
      .populate('agent', 'username email phone');

    const applicant = await User.findById(updatedVisaApplication.applicant);
    if (applicant) {
      await EmailService.notifyVisaStatusChange(updatedVisaApplication, applicant, previousStatus, notes);
    }
    
    res.status(200).json({
      success: true,
      message: 'Visa application status updated successfully',
      visaApplication: updatedVisaApplication
    });
  } catch (error) {
    console.error('Error updating visa application status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update visa application status',
      error: error.message
    });
  }
};

// Add document to visa application
const addDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { documentUrl } = req.body;
    const userId = req.user.payload.id;

    if (!documentUrl) {
      return res.status(400).json({
        success: false,
        message: 'Document URL is required'
      });
    }

    // Find the visa application
    const visaApplication = await Visa.findById(id);

    if (!visaApplication) {
      return res.status(404).json({
        success: false,
        message: 'Visa application not found'
      });
    }

    // Check if user has permission to add documents
    const isApplicant = visaApplication.applicant.toString() === userId;
    const isAssignedAgent = visaApplication.agent && visaApplication.agent.toString() === userId;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';
    const isAgent = req.user.payload.role === 'AGENT';

    if (!isApplicant && !isAssignedAgent && !isAdmin && !isAgent) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to add documents to this visa application'
      });
    }

    // Add the document
    visaApplication.documents.push(documentUrl);
    visaApplication.updated_at = Date.now();

    await visaApplication.save();

    const updatedVisaApplication = await Visa.findById(id)
      .populate('applicant', 'username email phone')
      .populate('agent', 'username email phone');

    res.status(200).json({
      success: true,
      message: 'Document added successfully',
      visaApplication: updatedVisaApplication
    });
  } catch (error) {
    console.error('Error adding document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add document',
      error: error.message
    });
  }
};

// Remove document from visa application
const removeDocument = async (req, res) => {
  try {
    const { id, documentIndex } = req.params;
    const userId = req.user.payload.id;
    const idx = parseInt(documentIndex);

    // Find the visa application
    const visaApplication = await Visa.findById(id);

    if (!visaApplication) {
      return res.status(404).json({
        success: false,
        message: 'Visa application not found'
      });
    }

    // Check if user has permission to remove documents
    const isApplicant = visaApplication.applicant.toString() === userId;
    const isAssignedAgent = visaApplication.agent && visaApplication.agent.toString() === userId;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';
    const isAgent = req.user.payload.role === 'AGENT';

    if (!isApplicant && !isAssignedAgent && !isAdmin && !isAgent) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to remove documents from this visa application'
      });
    }

    // Check if document index is valid
    if (isNaN(idx) || idx < 0 || idx >= visaApplication.documents.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document index'
      });
    }

    // Remove the document
    visaApplication.documents.splice(idx, 1);
    visaApplication.updated_at = Date.now();

    await visaApplication.save();

    const updatedVisaApplication = await Visa.findById(id)
      .populate('applicant', 'username email phone')
      .populate('agent', 'username email phone');

    res.status(200).json({
      success: true,
      message: 'Document removed successfully',
      visaApplication: updatedVisaApplication
    });
  } catch (error) {
    console.error('Error removing document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove document',
      error: error.message
    });
  }
};
// Add this method
const getVisaStatistics = async (req, res) => {
  try {
    // Get total applications
    const total = await Visa.countDocuments();
    
    // Get counts by status
    const submitted = await Visa.countDocuments({ status: 'SUBMITTED' });
    const approved = await Visa.countDocuments({ status: 'APPROVED' });
    const rejected = await Visa.countDocuments({ status: 'REJECTED' });
    
    res.status(200).json({
      success: true,
      stats: {
        total,
        submitted,
        approved,
        rejected
      }
    });
  } catch (error) {
    console.error('Error getting visa statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch visa statistics',
      error: error.message
    });
  }
};

module.exports = {
  getAllVisaApplications,
  getVisaApplicationById,
  createVisaApplication,
  updateVisaApplication,
  deleteVisaApplication,
  getUserVisaApplications,
  getAgentVisaApplications,
  assignAgent,
  changeStatus,
  addDocument,
  removeDocument,
  getVisaStatistics
};