// Validator for creating an insurance policy
const createPolicyValidator = (req, res, next) => {
    const { type, provider, coverageDetails } = req.body;
    let errors = [];
  
    // Check insurance type
    if (!type) {
      errors.push('Insurance type is required');
    } else {
      const validTypes = ['LIFE', 'HEALTH', 'AUTO', 'HOME', 'TRAVEL'];
      if (!validTypes.includes(type)) {
        errors.push(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
      }
    }
  
    // Check provider
    if (!provider) {
      errors.push('Insurance provider is required');
    } else if (provider.length < 2) {
      errors.push('Provider name must be at least 2 characters');
    }
  
    // Check coverage details
    if (!coverageDetails) {
      errors.push('Coverage details are required');
    } else {
      if (!coverageDetails.startDate) {
        errors.push('Coverage start date is required');
      }
      
      if (!coverageDetails.endDate) {
        errors.push('Coverage end date is required');
      } else {
        // Check if end date is after start date
        const startDate = new Date(coverageDetails.startDate);
        const endDate = new Date(coverageDetails.endDate);
        
        if (endDate <= startDate) {
          errors.push('Coverage end date must be after start date');
        }
      }
      
      if (!coverageDetails.coverageAmount) {
        errors.push('Coverage amount is required');
      } else if (isNaN(coverageDetails.coverageAmount) || coverageDetails.coverageAmount <= 0) {
        errors.push('Coverage amount must be a positive number');
      }
      
      if (!coverageDetails.premium) {
        errors.push('Premium amount is required');
      } else if (isNaN(coverageDetails.premium) || coverageDetails.premium <= 0) {
        errors.push('Premium must be a positive number');
      }
      
      if (coverageDetails.paymentFrequency) {
        const validFrequencies = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'];
        if (!validFrequencies.includes(coverageDetails.paymentFrequency)) {
          errors.push(`Invalid payment frequency. Must be one of: ${validFrequencies.join(', ')}`);
        }
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
  
  // Validator for updating an insurance policy
  const updatePolicyValidator = (req, res, next) => {
    const { type, status, coverageDetails } = req.body;
    let errors = [];
  
    // Check insurance type if provided
    if (type) {
      const validTypes = ['LIFE', 'HEALTH', 'AUTO', 'HOME', 'TRAVEL'];
      if (!validTypes.includes(type)) {
        errors.push(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
      }
    }
  
    // Check status if provided
    if (status) {
      const validStatuses = ['ACTIVE', 'PENDING', 'EXPIRED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        errors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
    }
  
    // Check coverage details if provided
    if (coverageDetails) {
      if (coverageDetails.startDate && coverageDetails.endDate) {
        const startDate = new Date(coverageDetails.startDate);
        const endDate = new Date(coverageDetails.endDate);
        
        if (endDate <= startDate) {
          errors.push('Coverage end date must be after start date');
        }
      }
      
      if (coverageDetails.coverageAmount !== undefined) {
        if (isNaN(coverageDetails.coverageAmount) || coverageDetails.coverageAmount <= 0) {
          errors.push('Coverage amount must be a positive number');
        }
      }
      
      if (coverageDetails.premium !== undefined) {
        if (isNaN(coverageDetails.premium) || coverageDetails.premium <= 0) {
          errors.push('Premium must be a positive number');
        }
      }
      
      if (coverageDetails.paymentFrequency) {
        const validFrequencies = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'];
        if (!validFrequencies.includes(coverageDetails.paymentFrequency)) {
          errors.push(`Invalid payment frequency. Must be one of: ${validFrequencies.join(', ')}`);
        }
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
  
  // Validator for adding a beneficiary
  const beneficiaryValidator = (req, res, next) => {
    const { name, relationship, percentage } = req.body;
    let errors = [];
  
    if (!name) {
      errors.push('Beneficiary name is required');
    }
  
    if (!relationship) {
      errors.push('Relationship to policyholder is required');
    }
  
    if (percentage === undefined) {
      errors.push('Percentage is required');
    } else if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      errors.push('Percentage must be between 0 and 100');
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
    createPolicyValidator,
    updatePolicyValidator,
    beneficiaryValidator
  };