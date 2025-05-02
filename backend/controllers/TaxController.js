const Tax = require('../models/Tax');
const User = require('../models/User');

// Get all tax cases with pagination and filtering
const getAllTaxCases = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Basic filtering options
    const filter = {};
    
    // Admins and tax professionals can see all, users can only see their own
    const userId = req.user?.payload?.id;
    const isAdmin = req.user?.payload?.isAdmin || req.user?.payload?.role === 'ADMIN';
    const isSupport = req.user?.payload?.role === 'SUPPORT';
    
    if (!isAdmin && !isSupport) {
      filter.client = userId;
    }
    
    // Additional filters from query params
    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.fiscalYear) {
      filter.fiscalYear = req.query.fiscalYear;
    }

    // Execute query with pagination
    const taxCases = await Tax.find(filter)
      .populate('client', 'username email phone')
      .populate('taxProfessional', 'username email phone')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination info
    const total = await Tax.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: taxCases.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      taxCases
    });
  } catch (error) {
    console.error('Error fetching tax cases:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tax cases',
      error: error.message
    });
  }
};

// Get tax case by ID
const getTaxCaseById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.payload?.id;
    const isAdmin = req.user?.payload?.isAdmin || req.user?.payload?.role === 'ADMIN';
    const isSupport = req.user?.payload?.role === 'SUPPORT';

    const taxCase = await Tax.findById(id)
      .populate('client', 'username email phone address')
      .populate('taxProfessional', 'username email phone');

    if (!taxCase) {
      return res.status(404).json({
        success: false,
        message: 'Tax case not found'
      });
    }

    // Check permissions - only allow access to own tax cases unless admin/support
    if (!isAdmin && !isSupport && taxCase.client._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own tax cases'
      });
    }

    res.status(200).json({
      success: true,
      taxCase
    });
  } catch (error) {
    console.error('Error fetching tax case:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tax case',
      error: error.message
    });
  }
};

// Create new tax case
const createTaxCase = async (req, res) => {
  try {
    const { 
      type, fiscalYear, details, clientUserId, documents, notes 
    } = req.body;

    // Default to current user if clientUserId not provided or not admin/support
    const creatorId = req.user.payload.id;
    const creatorRole = req.user.payload.role;
    const isAdmin = req.user.payload.isAdmin || creatorRole === 'ADMIN';
    const isSupport = creatorRole === 'SUPPORT';
    
    // Determine client
    let clientId = creatorId;
    
    // If admin or support is creating for someone else
    if ((isAdmin || isSupport) && clientUserId) {
      // Check if the specified client exists
      const clientExists = await User.findById(clientUserId);
      if (!clientExists) {
        return res.status(404).json({
          success: false,
          message: 'Specified client user not found'
        });
      }
      clientId = clientUserId;
    }

    // Create tax case
    const newTaxCase = new Tax({
      type,
      client: clientId,
      fiscalYear,
      details: details || {},
      status: 'PENDING',
      documents: documents || [],
      notes: notes || '',
      taxProfessional: (isAdmin || isSupport) ? creatorId : undefined
    });

    const savedTaxCase = await newTaxCase.save();

    // Populate the response data
    const populatedTaxCase = await Tax.findById(savedTaxCase._id)
      .populate('client', 'username email phone')
      .populate('taxProfessional', 'username email phone');

    res.status(201).json({
      success: true,
      message: 'Tax case created successfully',
      taxCase: populatedTaxCase
    });
  } catch (error) {
    console.error('Error creating tax case:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create tax case',
      error: error.message
    });
  }
};

// Update tax case
const updateTaxCase = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.payload.id;
    const userRole = req.user.payload.role;
    const isAdmin = req.user.payload.isAdmin || userRole === 'ADMIN';
    const isSupport = userRole === 'SUPPORT';

    // Find the tax case
    const taxCase = await Tax.findById(id);
    
    if (!taxCase) {
      return res.status(404).json({
        success: false,
        message: 'Tax case not found'
      });
    }

    // Check if user has permission to update
    const isClient = taxCase.client.toString() === userId;
    const isAssignedProfessional = taxCase.taxProfessional && taxCase.taxProfessional.toString() === userId;

    if (!isClient && !isAssignedProfessional && !isAdmin && !isSupport) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this tax case'
      });
    }

    // Define allowed fields based on role
    let allowedUpdates = [];
    
    if (isAdmin || isSupport) {
      // Admins and support staff can update all fields
      allowedUpdates = [
        'type', 'fiscalYear', 'details', 
        'status', 'documents', 'notes', 'taxProfessional'
      ];
    } else if (isAssignedProfessional) {
      // Tax professionals can update most fields
      allowedUpdates = [
        'details', 'status', 'documents', 'notes'
      ];
    } else if (isClient) {
      // Clients can only update limited fields
      allowedUpdates = ['documents', 'notes'];
      
      // Allow clients to update details only if case is in PENDING or REVISION_NEEDED status
      if (taxCase.status === 'PENDING' || taxCase.status === 'REVISION_NEEDED') {
        allowedUpdates.push('details');
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

    // Update the tax case
    const updatedTaxCase = await Tax.findByIdAndUpdate(
      id,
      filteredUpdates,
      { new: true, runValidators: true }
    ).populate('client', 'username email phone')
     .populate('taxProfessional', 'username email phone');

    res.status(200).json({
      success: true,
      message: 'Tax case updated successfully',
      taxCase: updatedTaxCase
    });
  } catch (error) {
    console.error('Error updating tax case:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tax case',
      error: error.message
    });
  }
};

// Delete tax case
const deleteTaxCase = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.payload.id;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';

    // Find the tax case
    const taxCase = await Tax.findById(id);
    
    if (!taxCase) {
      return res.status(404).json({
        success: false,
        message: 'Tax case not found'
      });
    }

    // Check if user has permission to delete
    // Only admin or the client (if case is still in PENDING status)
    const isClient = taxCase.client.toString() === userId;
    const isDeletable = taxCase.status === 'PENDING';

    if (!isAdmin && (!isClient || !isDeletable)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this tax case'
      });
    }

    // Delete the tax case
    await Tax.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Tax case deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting tax case:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete tax case',
      error: error.message
    });
  }
};

// Get user's tax cases
const getUserTaxCases = async (req, res) => {
  try {
    const userId = req.user.payload.id;

    // Get cases where user is client
    const taxCases = await Tax.find({ client: userId })
      .populate('client', 'username email phone')
      .populate('taxProfessional', 'username email phone')
      .sort({ created_at: -1 });

    res.status(200).json({
      success: true,
      count: taxCases.length,
      taxCases
    });
  } catch (error) {
    console.error('Error fetching user tax cases:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user tax cases',
      error: error.message
    });
  }
};

// Get tax professional's assigned tax cases
const getProfessionalTaxCases = async (req, res) => {
  try {
    const userId = req.user.payload.id;
    const userRole = req.user.payload.role;
    const isAdmin = req.user.payload.isAdmin || userRole === 'ADMIN';
    const isSupport = userRole === 'SUPPORT';

    if (!isAdmin && !isSupport) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only tax professionals and admins can access this endpoint'
      });
    }

    // Get cases where user is the assigned tax professional
    const taxCases = await Tax.find({ taxProfessional: userId })
      .populate('client', 'username email phone')
      .populate('taxProfessional', 'username email phone')
      .sort({ created_at: -1 });

    res.status(200).json({
      success: true,
      count: taxCases.length,
      taxCases
    });
  } catch (error) {
    console.error('Error fetching professional tax cases:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch professional tax cases',
      error: error.message
    });
  }
};

// Assign tax professional to tax case (for Admins)
const assignTaxProfessional = async (req, res) => {
  try {
    const { id } = req.params;
    const { taxProfessionalId } = req.body;
    const userId = req.user.payload.id;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';

    // Only admins can assign tax professionals
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can assign tax professionals to tax cases'
      });
    }

    // Find the tax case
    const taxCase = await Tax.findById(id);
    
    if (!taxCase) {
      return res.status(404).json({
        success: false,
        message: 'Tax case not found'
      });
    }

    // Check if tax professional exists and has appropriate role
    if (taxProfessionalId) {
      const taxProfessional = await User.findById(taxProfessionalId);
      
      if (!taxProfessional) {
        return res.status(404).json({
          success: false,
          message: 'Tax professional not found'
        });
      }

      if (taxProfessional.role !== 'SUPPORT' && taxProfessional.role !== 'ADMIN') {
        return res.status(400).json({
          success: false,
          message: 'Assigned user must be a tax professional (SUPPORT role) or admin'
        });
      }
    }

    // Update the tax case with new tax professional (or remove if taxProfessionalId is null)
    const updatedTaxCase = await Tax.findByIdAndUpdate(
      id,
      { taxProfessional: taxProfessionalId || null, updated_at: Date.now() },
      { new: true, runValidators: true }
    ).populate('client', 'username email phone')
     .populate('taxProfessional', 'username email phone');

    res.status(200).json({
      success: true,
      message: taxProfessionalId ? 'Tax professional assigned successfully' : 'Tax professional removed successfully',
      taxCase: updatedTaxCase
    });
  } catch (error) {
    console.error('Error assigning tax professional:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign tax professional',
      error: error.message
    });
  }
};

// Change tax case status
const changeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const userId = req.user.payload.id;
    const userRole = req.user.payload.role;
    const isAdmin = req.user.payload.isAdmin || userRole === 'ADMIN';
    const isSupport = userRole === 'SUPPORT';

    // Check if status is valid
    const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REVISION_NEEDED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Find the tax case
    const taxCase = await Tax.findById(id);
    
    if (!taxCase) {
      return res.status(404).json({
        success: false,
        message: 'Tax case not found'
      });
    }

    // Check if user has permission to update status
    const isAssignedProfessional = taxCase.taxProfessional && taxCase.taxProfessional.toString() === userId;

    if (!isAssignedProfessional && !isAdmin && !isSupport) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this tax case status'
      });
    }

    // Update the tax case status and add notes if provided
    const updateData = { 
      status, 
      updated_at: Date.now()
    };

    if (notes) {
      updateData.notes = taxCase.notes 
        ? `${taxCase.notes}\n\n${new Date().toISOString()}: ${notes}`
        : `${new Date().toISOString()}: ${notes}`;
    }

    const updatedTaxCase = await Tax.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('client', 'username email phone')
     .populate('taxProfessional', 'username email phone');

    res.status(200).json({
      success: true,
      message: 'Tax case status updated successfully',
      taxCase: updatedTaxCase
    });
  } catch (error) {
    console.error('Error updating tax case status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tax case status',
      error: error.message
    });
  }
};

// Add document to tax case
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

    // Find the tax case
    const taxCase = await Tax.findById(id);
    
    if (!taxCase) {
      return res.status(404).json({
        success: false,
        message: 'Tax case not found'
      });
    }

    // Check if user has permission to add documents
    const isClient = taxCase.client.toString() === userId;
    const isAssignedProfessional = taxCase.taxProfessional && taxCase.taxProfessional.toString() === userId;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';
    const isSupport = req.user.payload.role === 'SUPPORT';

    if (!isClient && !isAssignedProfessional && !isAdmin && !isSupport) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to add documents to this tax case'
      });
    }

    // Add the document
    taxCase.documents.push(documentUrl);
    taxCase.updated_at = Date.now();
    
    await taxCase.save();

    const updatedTaxCase = await Tax.findById(id)
      .populate('client', 'username email phone')
      .populate('taxProfessional', 'username email phone');

    res.status(200).json({
      success: true,
      message: 'Document added successfully',
      taxCase: updatedTaxCase
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

// Remove document from tax case
const removeDocument = async (req, res) => {
  try {
    const { id, documentIndex } = req.params;
    const userId = req.user.payload.id;
    const idx = parseInt(documentIndex);
    
    // Find the tax case
    const taxCase = await Tax.findById(id);
    
    if (!taxCase) {
      return res.status(404).json({
        success: false,
        message: 'Tax case not found'
      });
    }

    // Check if user has permission to remove documents
    const isClient = taxCase.client.toString() === userId;
    const isAssignedProfessional = taxCase.taxProfessional && taxCase.taxProfessional.toString() === userId;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';
    const isSupport = req.user.payload.role === 'SUPPORT';

    if (!isClient && !isAssignedProfessional && !isAdmin && !isSupport) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to remove documents from this tax case'
      });
    }

    // Check if document index is valid
    if (isNaN(idx) || idx < 0 || idx >= taxCase.documents.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document index'
      });
    }

    // Remove the document
    taxCase.documents.splice(idx, 1);
    taxCase.updated_at = Date.now();
    
    await taxCase.save();

    const updatedTaxCase = await Tax.findById(id)
      .populate('client', 'username email phone')
      .populate('taxProfessional', 'username email phone');

    res.status(200).json({
      success: true,
      message: 'Document removed successfully',
      taxCase: updatedTaxCase
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
const getTaxStatistics = async (req, res) => {
  try {
    // Get total tax cases
    const total = await Tax.countDocuments();
    
    // Get counts by status
    const pending = await Tax.countDocuments({ status: 'PENDING' });
    const inProgress = await Tax.countDocuments({ status: 'IN_PROGRESS' });
    const completed = await Tax.countDocuments({ status: 'COMPLETED' });
    
    res.status(200).json({
      success: true,
      stats: {
        total,
        pending,
        inProgress,
        completed
      }
    });
  } catch (error) {
    console.error('Error getting tax statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tax statistics',
      error: error.message
    });
  }
};



module.exports = {
  getAllTaxCases,
  getTaxCaseById,
  createTaxCase,
  updateTaxCase,
  deleteTaxCase,
  getUserTaxCases,
  getProfessionalTaxCases,
  assignTaxProfessional,
  changeStatus,
  addDocument,
  removeDocument,
  getTaxStatistics
};