// Validator for creating a visa application
const createVisaValidator = (req, res, next) => {
    const { type, destination, purpose, applicationDetails } = req.body;
    let errors = [];
  
    // Check visa type
    if (!type) {
      errors.push('Visa type is required');
    } else {
      const validTypes = ['BUSINESS', 'TOURIST', 'GUARANTOR'];
      if (!validTypes.includes(type)) {
        errors.push(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
      }
    }
  
    // Check destination
    if (!destination) {
      errors.push('Destination country is required');
    } else if (destination.length < 2) {
      errors.push('Destination name must be at least 2 characters');
    }
  
    // Check purpose
    if (!purpose) {
      errors.push('Purpose of visit is required');
    } else if (purpose.length < 10) {
      errors.push('Purpose must be at least 10 characters');
    }
  
    // Check application details
    if (!applicationDetails) {
      errors.push('Application details are required');
    } else {
      if (!applicationDetails.passportNumber) {
        errors.push('Passport number is required');
      }
      
      if (!applicationDetails.issueDate) {
        errors.push('Passport issue date is required');
      }
      
      if (!applicationDetails.expiryDate) {
        errors.push('Passport expiry date is required');
      } else {
        // Check if expiry date is after current date
        const expiryDate = new Date(applicationDetails.expiryDate);
        const currentDate = new Date();
        
        if (expiryDate <= currentDate) {
          errors.push('Passport expiry date must be in the future');
        }
      }
      
      if (applicationDetails.entryType) {
        const validEntryTypes = ['SINGLE', 'MULTIPLE', 'TRANSIT'];
        if (!validEntryTypes.includes(applicationDetails.entryType)) {
          errors.push(`Invalid entry type. Must be one of: ${validEntryTypes.join(', ')}`);
        }
      }
      
      if (applicationDetails.durationOfStay !== undefined) {
        if (isNaN(applicationDetails.durationOfStay) || applicationDetails.durationOfStay <= 0) {
          errors.push('Duration of stay must be a positive number');
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
  
  // Validator for updating a visa application
  const updateVisaValidator = (req, res, next) => {
    const { type, destination, purpose, applicationDetails, status } = req.body;
    let errors = [];
  
    // Check visa type if provided
    if (type) {
      const validTypes = ['BUSINESS', 'TOURIST', 'GUARANTOR'];
      if (!validTypes.includes(type)) {
        errors.push(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
      }
    }
  
    // Check destination if provided
    if (destination && destination.length < 2) {
      errors.push('Destination name must be at least 2 characters');
    }
  
    // Check purpose if provided
    if (purpose && purpose.length < 10) {
      errors.push('Purpose must be at least 10 characters');
    }
  
    // Check application details if provided
    if (applicationDetails) {
      if (applicationDetails.expiryDate) {
        // Check if expiry date is after current date
        const expiryDate = new Date(applicationDetails.expiryDate);
        const currentDate = new Date();
        
        if (expiryDate <= currentDate) {
          errors.push('Passport expiry date must be in the future');
        }
      }
      
      if (applicationDetails.entryType) {
        const validEntryTypes = ['SINGLE', 'MULTIPLE', 'TRANSIT'];
        if (!validEntryTypes.includes(applicationDetails.entryType)) {
          errors.push(`Invalid entry type. Must be one of: ${validEntryTypes.join(', ')}`);
        }
      }
      
      if (applicationDetails.durationOfStay !== undefined) {
        if (isNaN(applicationDetails.durationOfStay) || applicationDetails.durationOfStay <= 0) {
          errors.push('Duration of stay must be a positive number');
        }
      }
    }
  
    // Check status if provided
    if (status) {
      const validStatuses = ['SUBMITTED', 'PROCESSING', 'APPROVED', 'REJECTED', 'ADDITIONAL_INFO_REQUIRED'];
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
  
  // Validator for document URL
  const documentValidator = (req, res, next) => {
    const { documentUrl } = req.body;
    let errors = [];
  
    if (!documentUrl) {
      errors.push('Document URL is required');
    } else if (typeof documentUrl !== 'string') {
      errors.push('Document URL must be a string');
    } else {
      try {
        // Basic URL validation
        new URL(documentUrl);
      } catch (e) {
        errors.push('Invalid document URL format');
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
    createVisaValidator,
    updateVisaValidator,
    documentValidator
  };