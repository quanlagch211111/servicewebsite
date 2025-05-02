const Insurance = require('../models/Insurance');
const User = require('../models/User');

// Get all insurance policies with pagination and filtering
const getAllPolicies = async (req, res) => {
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
      filter.policyholder = userId;
    }
    
    // Additional filters from query params
    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.provider) {
      filter.provider = { $regex: req.query.provider, $options: 'i' };
    }

    // Date range filter for coverage
    if (req.query.startAfter) {
      filter['coverageDetails.startDate'] = { $gte: new Date(req.query.startAfter) };
    }
    
    if (req.query.endBefore) {
      filter['coverageDetails.endDate'] = { $lte: new Date(req.query.endBefore) };
    }

    // Execute query with pagination
    const policies = await Insurance.find(filter)
      .populate('policyholder', 'username email phone')
      .populate('agent', 'username email phone')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination info
    const total = await Insurance.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: policies.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      policies
    });
  } catch (error) {
    console.error('Error fetching insurance policies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch insurance policies',
      error: error.message
    });
  }
};

// Get insurance policy by ID
const getPolicyById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.payload?.id;
    const isAdmin = req.user?.payload?.isAdmin || req.user?.payload?.role === 'ADMIN';
    const isAgent = req.user?.payload?.role === 'AGENT';

    const policy = await Insurance.findById(id)
      .populate('policyholder', 'username email phone address')
      .populate('agent', 'username email phone');

    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Insurance policy not found'
      });
    }

    // Check permissions - only allow access to own policies unless admin/agent
    if (!isAdmin && !isAgent && policy.policyholder._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own insurance policies'
      });
    }

    res.status(200).json({
      success: true,
      policy
    });
  } catch (error) {
    console.error('Error fetching insurance policy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch insurance policy',
      error: error.message
    });
  }
};

// Create new insurance policy
const createPolicy = async (req, res) => {
  try {
    const { 
      type, provider, policyholderUserId, beneficiaries, 
      coverageDetails, status, documents 
    } = req.body;

    // Default to current user if policyholderUserId not provided or not admin/agent
    const creatorId = req.user.payload.id;
    const creatorRole = req.user.payload.role;
    const isAdmin = req.user.payload.isAdmin || creatorRole === 'ADMIN';
    const isAgent = creatorRole === 'AGENT';
    
    // Determine policyholder
    let policyholderId = creatorId;
    
    // If admin or agent is creating for someone else
    if ((isAdmin || isAgent) && policyholderUserId) {
      // Check if the specified policyholder exists
      const policyholderExists = await User.findById(policyholderUserId);
      if (!policyholderExists) {
        return res.status(404).json({
          success: false,
          message: 'Specified policyholder user not found'
        });
      }
      policyholderId = policyholderUserId;
    }

    // Generate unique policy number
    const policyNumber = `POL-${type.substring(0, 3)}-${Date.now().toString().substring(7)}-${Math.floor(Math.random() * 1000)}`;

    // Create policy
    const newPolicy = new Insurance({
      type,
      policyNumber,
      provider,
      policyholder: policyholderId,
      beneficiaries: beneficiaries || [],
      coverageDetails,
      status: status || 'PENDING',
      documents: documents || [],
      agent: (isAdmin || isAgent) ? creatorId : undefined
    });

    const savedPolicy = await newPolicy.save();

    // Populate the response data
    const populatedPolicy = await Insurance.findById(savedPolicy._id)
      .populate('policyholder', 'username email phone')
      .populate('agent', 'username email phone');

    res.status(201).json({
      success: true,
      message: 'Insurance policy created successfully',
      policy: populatedPolicy
    });
  } catch (error) {
    console.error('Error creating insurance policy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create insurance policy',
      error: error.message
    });
  }
};

// Update insurance policy
const updatePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.payload.id;
    const userRole = req.user.payload.role;
    const isAdmin = req.user.payload.isAdmin || userRole === 'ADMIN';
    const isAgent = userRole === 'AGENT';

    // Find the policy
    const policy = await Insurance.findById(id);
    
    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Insurance policy not found'
      });
    }

    // Check if user has permission to update
    const isPolicyholder = policy.policyholder.toString() === userId;
    const isAssignedAgent = policy.agent && policy.agent.toString() === userId;

    if (!isPolicyholder && !isAssignedAgent && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this insurance policy'
      });
    }

    // Define allowed fields based on role
    let allowedUpdates = [];
    
    if (isAdmin || isAgent) {
      // Admins and agents can update all fields
      allowedUpdates = [
        'type', 'provider', 'policyholder', 'beneficiaries',
        'coverageDetails', 'status', 'documents', 'agent'
      ];
    } else if (isPolicyholder) {
      // Policyholders can only update limited fields
      allowedUpdates = ['beneficiaries', 'documents'];
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

    // Update the policy
    const updatedPolicy = await Insurance.findByIdAndUpdate(
      id,
      filteredUpdates,
      { new: true, runValidators: true }
    ).populate('policyholder', 'username email phone')
     .populate('agent', 'username email phone');

    res.status(200).json({
      success: true,
      message: 'Insurance policy updated successfully',
      policy: updatedPolicy
    });
  } catch (error) {
    console.error('Error updating insurance policy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update insurance policy',
      error: error.message
    });
  }
};

// Delete insurance policy
const deletePolicy = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.payload.id;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';

    // Find the policy
    const policy = await Insurance.findById(id);
    
    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Insurance policy not found'
      });
    }

    // Only admins can delete policies
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete insurance policies'
      });
    }

    // Delete the policy
    await Insurance.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Insurance policy deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting insurance policy:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete insurance policy',
      error: error.message
    });
  }
};

// Get user's insurance policies
const getUserPolicies = async (req, res) => {
  try {
    const userId = req.user.payload.id;

    // Get policies where user is policyholder
    const policies = await Insurance.find({ policyholder: userId })
      .populate('policyholder', 'username email phone')
      .populate('agent', 'username email phone')
      .sort({ created_at: -1 });

    res.status(200).json({
      success: true,
      count: policies.length,
      policies
    });
  } catch (error) {
    console.error('Error fetching user insurance policies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user insurance policies',
      error: error.message
    });
  }
};

// Assign agent to policy (for Admins)
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
        message: 'Only administrators can assign agents to policies'
      });
    }

    // Find the policy
    const policy = await Insurance.findById(id);
    
    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Insurance policy not found'
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

    // Update the policy with new agent (or remove if agentId is null)
    const updatedPolicy = await Insurance.findByIdAndUpdate(
      id,
      { agent: agentId || null, updated_at: Date.now() },
      { new: true, runValidators: true }
    ).populate('policyholder', 'username email phone')
     .populate('agent', 'username email phone');

    res.status(200).json({
      success: true,
      message: agentId ? 'Agent assigned successfully' : 'Agent removed successfully',
      policy: updatedPolicy
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

// Change policy status
const changeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.payload.id;
    const userRole = req.user.payload.role;
    const isAdmin = req.user.payload.isAdmin || userRole === 'ADMIN';
    const isAgent = userRole === 'AGENT';

    // Check if status is valid
    const validStatuses = ['ACTIVE', 'PENDING', 'EXPIRED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Find the policy
    const policy = await Insurance.findById(id);
    
    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Insurance policy not found'
      });
    }

    // Check if user has permission to update status
    const isAssignedAgent = policy.agent && policy.agent.toString() === userId;

    if (!isAssignedAgent && !isAdmin && !isAgent) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this policy status'
      });
    }

    // Update the policy status
    const updatedPolicy = await Insurance.findByIdAndUpdate(
      id,
      { status, updated_at: Date.now() },
      { new: true, runValidators: true }
    ).populate('policyholder', 'username email phone')
     .populate('agent', 'username email phone');

    res.status(200).json({
      success: true,
      message: 'Insurance policy status updated successfully',
      policy: updatedPolicy
    });
  } catch (error) {
    console.error('Error updating insurance policy status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update insurance policy status',
      error: error.message
    });
  }
};

// Add beneficiary to policy
const addBeneficiary = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, relationship, percentage } = req.body;
    const userId = req.user.payload.id;
    
    // Find the policy
    const policy = await Insurance.findById(id);
    
    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Insurance policy not found'
      });
    }

    // Check if user is the policyholder or admin
    const isPolicyholder = policy.policyholder.toString() === userId;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';
    
    if (!isPolicyholder && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update beneficiaries'
      });
    }

    // Validate beneficiary data
    if (!name || !relationship || percentage === undefined || percentage < 0 || percentage > 100) {
      return res.status(400).json({
        success: false,
        message: 'Invalid beneficiary details. Name, relationship, and percentage (0-100) are required.'
      });
    }

    // Add new beneficiary
    const newBeneficiary = { name, relationship, percentage };
    policy.beneficiaries.push(newBeneficiary);
    
    // Check if total percentage exceeds 100%
    const totalPercentage = policy.beneficiaries.reduce((sum, ben) => sum + ben.percentage, 0);
    if (totalPercentage > 100) {
      return res.status(400).json({
        success: false,
        message: 'Total beneficiary percentage cannot exceed 100%'
      });
    }
    
    policy.updated_at = Date.now();
    
    await policy.save();

    const updatedPolicy = await Insurance.findById(id)
      .populate('policyholder', 'username email phone')
      .populate('agent', 'username email phone');

    res.status(200).json({
      success: true,
      message: 'Beneficiary added successfully',
      policy: updatedPolicy
    });
  } catch (error) {
    console.error('Error adding beneficiary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add beneficiary',
      error: error.message
    });
  }
};

// Remove beneficiary from policy
const removeBeneficiary = async (req, res) => {
  try {
    const { id, beneficiaryIndex } = req.params;
    const userId = req.user.payload.id;
    const idx = parseInt(beneficiaryIndex);
    
    // Find the policy
    const policy = await Insurance.findById(id);
    
    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Insurance policy not found'
      });
    }

    // Check if user is the policyholder or admin
    const isPolicyholder = policy.policyholder.toString() === userId;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';
    
    if (!isPolicyholder && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update beneficiaries'
      });
    }

    // Check if beneficiary index is valid
    if (isNaN(idx) || idx < 0 || idx >= policy.beneficiaries.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid beneficiary index'
      });
    }

    // Remove the beneficiary
    policy.beneficiaries.splice(idx, 1);
    policy.updated_at = Date.now();
    
    await policy.save();

    const updatedPolicy = await Insurance.findById(id)
      .populate('policyholder', 'username email phone')
      .populate('agent', 'username email phone');

    res.status(200).json({
      success: true,
      message: 'Beneficiary removed successfully',
      policy: updatedPolicy
    });
  } catch (error) {
    console.error('Error removing beneficiary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove beneficiary',
      error: error.message
    });
  }
};


// Add this method
const getInsuranceStatistics = async (req, res) => {
  try {
    // Get total policies
    const total = await Insurance.countDocuments();
    
    // Get counts by status
    const active = await Insurance.countDocuments({ status: 'ACTIVE' });
    const pending = await Insurance.countDocuments({ status: 'PENDING' });
    const expired = await Insurance.countDocuments({ status: 'EXPIRED' });
    
    res.status(200).json({
      success: true,
      stats: {
        total,
        active,
        pending,
        expired
      }
    });
  } catch (error) {
    console.error('Error getting insurance statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch insurance statistics',
      error: error.message
    });
  }
};


module.exports = {
  getAllPolicies,
  getPolicyById,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getUserPolicies,
  assignAgent,
  changeStatus,
  addBeneficiary,
  removeBeneficiary,
  getInsuranceStatistics
};