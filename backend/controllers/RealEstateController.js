const RealEstate = require('../models/RealEstate');
const User = require('../models/User');
const UploadService = require('../services/UploadService');

// Get all properties with pagination and filtering
const getAllProperties = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Basic filtering options
    const filter = { status: 'AVAILABLE' };  // Default to available properties
    
    // Additional filters from query params
    if (req.query.type) {
      filter.type = req.query.type;
    }
    
    if (req.query.minPrice && req.query.maxPrice) {
      filter.price = { 
        $gte: parseFloat(req.query.minPrice), 
        $lte: parseFloat(req.query.maxPrice) 
      };
    } else if (req.query.minPrice) {
      filter.price = { $gte: parseFloat(req.query.minPrice) };
    } else if (req.query.maxPrice) {
      filter.price = { $lte: parseFloat(req.query.maxPrice) };
    }

    if (req.query.city) {
      filter['location.city'] = { $regex: req.query.city, $options: 'i' };
    }

    if (req.query.bedrooms) {
      filter['features.bedrooms'] = parseInt(req.query.bedrooms);
    }

    // Execute query with pagination
    const properties = await RealEstate.find(filter)
      .populate('owner', 'username email phone')
      .populate('agent', 'username email phone')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination info
    const total = await RealEstate.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: properties.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      properties
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch properties',
      error: error.message
    });
  }
};

// Get property by ID
const getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;

    const property = await RealEstate.findById(id)
      .populate('owner', 'username email phone')
      .populate('agent', 'username email phone');

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    res.status(200).json({
      success: true,
      property
    });
  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch property',
      error: error.message
    });
  }
};

// Create new property
const createProperty = async (req, res) => {
  try {
    const { 
      type, title, description, price, location, features, images, status
    } = req.body;

    const userId = req.user.payload.id;

    // Validate the role if it's an agent creating the property
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // If user is not ADMIN or AGENT, they can only create properties they own
    const isPropertyProfessional = ['ADMIN', 'AGENT'].includes(user.role);

    // Create the property
    const newProperty = new RealEstate({
      type,
      title,
      description,
      price,
      location,
      features,
      images: images || [],
      status: status || 'AVAILABLE',
      owner: req.body.owner || userId, // If owner is not specified, use current user
      agent: isPropertyProfessional ? userId : undefined // Set agent if user is a professional
    });

    // Save the property
    const savedProperty = await newProperty.save();

    res.status(201).json({
      success: true,
      message: 'Property created successfully',
      property: savedProperty
    });
  } catch (error) {
    console.error('Error creating property:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create property',
      error: error.message
    });
  }
};

// Update property
const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.payload.id;

    // Find the property
    const property = await RealEstate.findById(id);
    
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check if user has permission to update
    const isOwner = property.owner.toString() === userId;
    const isAssignedAgent = property.agent && property.agent.toString() === userId;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';

    if (!isOwner && !isAssignedAgent && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this property'
      });
    }

    // Update only allowed fields
    const allowedUpdates = [
      'title', 'description', 'price', 'location', 
      'features', 'images', 'status'
    ];
    
    // Add agent field to allowed updates if admin/owner
    if (isOwner || isAdmin) {
      allowedUpdates.push('agent', 'type');
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

    // Update the property
    const updatedProperty = await RealEstate.findByIdAndUpdate(
      id,
      filteredUpdates,
      { new: true, runValidators: true }
    ).populate('owner', 'username email phone')
     .populate('agent', 'username email phone');

    res.status(200).json({
      success: true,
      message: 'Property updated successfully',
      property: updatedProperty
    });
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update property',
      error: error.message
    });
  }
};

// Delete property
const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.payload.id;

    // Find the property
    const property = await RealEstate.findById(id);
    
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check if user has permission to delete
    const isOwner = property.owner.toString() === userId;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this property'
      });
    }

    // Delete the property
    await RealEstate.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete property',
      error: error.message
    });
  }
};

// Get user's properties
const getUserProperties = async (req, res) => {
  try {
    const userId = req.user.payload.id;

    // Get properties where user is either owner or agent
    const properties = await RealEstate.find({
      $or: [
        { owner: userId },
        { agent: userId }
      ]
    }).populate('owner', 'username email phone')
      .populate('agent', 'username email phone')
      .sort({ created_at: -1 });

    res.status(200).json({
      success: true,
      count: properties.length,
      properties
    });
  } catch (error) {
    console.error('Error fetching user properties:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user properties',
      error: error.message
    });
  }
};

// Assign agent to property (for Admin and property owners)
const assignAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body;
    const userId = req.user.payload.id;

    // Find the property
    const property = await RealEstate.findById(id);
    
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check if user has permission to assign agent
    const isOwner = property.owner.toString() === userId;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to assign agent to this property'
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

    // Update the property with new agent (or remove if agentId is null)
    const updatedProperty = await RealEstate.findByIdAndUpdate(
      id,
      { agent: agentId || null, updated_at: Date.now() },
      { new: true, runValidators: true }
    ).populate('owner', 'username email phone')
     .populate('agent', 'username email phone');

    res.status(200).json({
      success: true,
      message: agentId ? 'Agent assigned successfully' : 'Agent removed successfully',
      property: updatedProperty
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

// Change property status
const changePropertyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.payload.id;

    // Check if status is valid
    const validStatuses = ['AVAILABLE', 'PENDING', 'SOLD', 'RENTED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Find the property
    const property = await RealEstate.findById(id);
    
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check if user has permission to update status
    const isOwner = property.owner.toString() === userId;
    const isAssignedAgent = property.agent && property.agent.toString() === userId;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';

    if (!isOwner && !isAssignedAgent && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this property status'
      });
    }

    // Update the property status
    const updatedProperty = await RealEstate.findByIdAndUpdate(
      id,
      { status, updated_at: Date.now() },
      { new: true, runValidators: true }
    ).populate('owner', 'username email phone')
     .populate('agent', 'username email phone');

    res.status(200).json({
      success: true,
      message: 'Property status updated successfully',
      property: updatedProperty
    });
  } catch (error) {
    console.error('Error updating property status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update property status',
      error: error.message
    });
  }
};

// Upload property images
const uploadImages = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.payload.id;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Find the property
    const property = await RealEstate.findById(id);
    
    if (!property) {
      // Delete uploaded files if property not found
      req.files.forEach(file => UploadService.deleteFile(file.path));
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check if user has permission to update
    const isOwner = property.owner.toString() === userId;
    const isAssignedAgent = property.agent && property.agent.toString() === userId;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';

    if (!isOwner && !isAssignedAgent && !isAdmin) {
      // Delete uploaded files if user does not have permission
      req.files.forEach(file => UploadService.deleteFile(file.path));
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to upload images for this property'
      });
    }

    // Get URLs for the uploaded files
    const imageUrls = req.files.map(file => UploadService.getFileUrl(req, file.path));
    
    // Update property images in database
    const updatedProperty = await RealEstate.findByIdAndUpdate(
      id,
      { 
        $push: { images: { $each: imageUrls } },
        updated_at: Date.now() 
      },
      { new: true, runValidators: true }
    ).populate('owner', 'username email phone')
     .populate('agent', 'username email phone');

    res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      property: updatedProperty
    });
  } catch (error) {
    // Delete uploaded files if error occurs
    if (req.files) {
      req.files.forEach(file => UploadService.deleteFile(file.path));
    }
    
    console.error('Error uploading property images:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload property images',
      error: error.message
    });
  }
};

// Delete property image
const deleteImage = async (req, res) => {
  try {
    const { id, imageIndex } = req.params;
    const userId = req.user.payload.id;
    const idx = parseInt(imageIndex);

    // Find the property
    const property = await RealEstate.findById(id);
    
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check if user has permission to update
    const isOwner = property.owner.toString() === userId;
    const isAssignedAgent = property.agent && property.agent.toString() === userId;
    const isAdmin = req.user.payload.isAdmin || req.user.payload.role === 'ADMIN';

    if (!isOwner && !isAssignedAgent && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete images for this property'
      });
    }

    // Check if image index is valid
    if (isNaN(idx) || idx < 0 || idx >= property.images.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid image index'
      });
    }

    // Get the image URL to delete the file later
    const imageUrl = property.images[idx];

    // Remove the image from the property
    property.images.splice(idx, 1);
    property.updated_at = Date.now();

    await property.save();

    // Try to delete the file from the server
    try {
      // Extract the file path from the URL
      const filePath = imageUrl.split('/uploads/')[1];
      if (filePath) {
        UploadService.deleteFile(path.join(UploadService.propertiesDir, filePath));
      }
    } catch (err) {
      console.warn('Could not delete image file:', err);
      // Continue even if file deletion fails
    }

    const updatedProperty = await RealEstate.findById(id)
      .populate('owner', 'username email phone')
      .populate('agent', 'username email phone');

    res.status(200).json({
      success: true,
      message: 'Image removed successfully',
      property: updatedProperty
    });
  } catch (error) {
    console.error('Error removing property image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove property image',
      error: error.message
    });
  }
};

// Add this method
const getPropertyStatistics = async (req, res) => {
  try {
    // Get total properties
    const total = await RealEstate.countDocuments();
    
    // Get counts by status
    const active = await RealEstate.countDocuments({ status: 'AVAILABLE' });
    const pending = await RealEstate.countDocuments({ status: 'PENDING' });
    const sold = await RealEstate.countDocuments({ status: 'SOLD' });
    
    res.status(200).json({
      success: true,
      stats: {
        total,
        active,
        pending,
        sold
      }
    });
  } catch (error) {
    console.error('Error getting property statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch property statistics',
      error: error.message
    });
  }
};

module.exports = {
  getAllProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  getUserProperties,
  assignAgent,
  changePropertyStatus,
  uploadImages,
  deleteImage,
  getPropertyStatistics
};