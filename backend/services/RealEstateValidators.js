// Validator for creating a property
const createPropertyValidator = (req, res, next) => {
    const { type, title, description, price, location } = req.body;
    let errors = [];
  
    // Check property type
    if (!type) {
      errors.push('Property type is required');
    } else {
      const validTypes = ['RENTAL', 'PURCHASE', 'BDS_INVESTMENT'];
      if (!validTypes.includes(type)) {
        errors.push(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
      }
    }
  
    // Check title
    if (!title) {
      errors.push('Title is required');
    } else if (title.length < 5 || title.length > 100) {
      errors.push('Title must be between 5 and 100 characters');
    }
  
    // Check description
    if (!description) {
      errors.push('Description is required');
    } else if (description.length < 20) {
      errors.push('Description must be at least 20 characters');
    }
  
    // Check price
    if (!price) {
      errors.push('Price is required');
    } else if (isNaN(price) || price <= 0) {
      errors.push('Price must be a positive number');
    }
  
    // Check location
    if (!location) {
      errors.push('Location is required');
    } else {
      if (!location.address) {
        errors.push('Location address is required');
      }
      if (!location.city) {
        errors.push('Location city is required');
      }
    }
  
    // Return errors if any
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors
      });
    }
  
    next();
  };
  
  // Validator for updating a property
  const updatePropertyValidator = (req, res, next) => {
    const { type, price, status } = req.body;
    let errors = [];
  
    // Check property type if provided
    if (type) {
      const validTypes = ['RENTAL', 'PURCHASE', 'BDS_INVESTMENT'];
      if (!validTypes.includes(type)) {
        errors.push(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
      }
    }
  
    // Check price if provided
    if (price !== undefined) {
      if (isNaN(price) || price <= 0) {
        errors.push('Price must be a positive number');
      }
    }
  
    // Check status if provided
    if (status) {
      const validStatuses = ['AVAILABLE', 'PENDING', 'SOLD', 'RENTED'];
      if (!validStatuses.includes(status)) {
        errors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
    }
  
    // Return errors if any
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors
      });
    }
  
    next();
  };
  
  module.exports = {
    createPropertyValidator,
    updatePropertyValidator
  };