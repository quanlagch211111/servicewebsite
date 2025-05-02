// Validator for creating a ticket
const createTicketValidator = (req, res, next) => {
    const { title, description, category } = req.body;
    let errors = [];
  
    // Check title
    if (!title) {
      errors.push('Title is required');
    } else if (title.length < 5 || title.length > 100) {
      errors.push('Title must be between 5 and 100 characters');
    }
  
    // Check description
    if (!description) {
      errors.push('Description is required');
    } else if (description.length < 10) {
      errors.push('Description must be at least 10 characters');
    }
  
    // Check category
    if (!category) {
      errors.push('Category is required');
    } else {
      const validCategories = ['REAL_ESTATE', 'INSURANCE', 'VISA', 'TAX', 'GENERAL'];
      if (!validCategories.includes(category)) {
        errors.push(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
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
  
  // Validator for updating a ticket
  const updateTicketValidator = (req, res, next) => {
    const { title, category, priority, status } = req.body;
    let errors = [];
  
    // Check title if provided
    if (title && (title.length < 5 || title.length > 100)) {
      errors.push('Title must be between 5 and 100 characters');
    }
  
    // Check category if provided
    if (category) {
      const validCategories = ['REAL_ESTATE', 'INSURANCE', 'VISA', 'TAX', 'GENERAL'];
      if (!validCategories.includes(category)) {
        errors.push(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
      }
    }
  
    // Check priority if provided
    if (priority) {
      const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
      if (!validPriorities.includes(priority)) {
        errors.push(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
      }
    }
  
    // Check status if provided
    if (status) {
      const validStatuses = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'];
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
  
  // Validator for adding a message
  const messageValidator = (req, res, next) => {
    const { content } = req.body;
    let errors = [];
  
    // Check content
    if (!content) {
      errors.push('Message content is required');
    } else if (content.trim() === '') {
      errors.push('Message content cannot be empty');
    } else if (content.length > 5000) {
      errors.push('Message content must be less than 5000 characters');
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
  
  // Validator for ticket attachments
  const attachmentsValidator = (req, res, next) => {
    const { attachments } = req.body;
    let errors = [];
  
    // Check attachments if provided
    if (attachments) {
      if (!Array.isArray(attachments)) {
        errors.push('Attachments must be an array');
      } else {
        // Validate each attachment URL
        for (let i = 0; i < attachments.length; i++) {
          if (typeof attachments[i] !== 'string') {
            errors.push(`Attachment at index ${i} is not a valid URL string`);
            continue;
          }
  
          try {
            new URL(attachments[i]);
          } catch (e) {
            errors.push(`Attachment at index ${i} is not a valid URL`);
          }
        }
  
        // Check if there are too many attachments
        if (attachments.length > 10) {
          errors.push('Maximum 10 attachments allowed per message');
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
  
  module.exports = {
    createTicketValidator,
    updateTicketValidator,
    messageValidator,
    attachmentsValidator
  };