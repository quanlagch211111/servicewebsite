const { body, validationResult } = require('express-validator');

// Middleware to check validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => err.msg)
    });
  }
  next();
};

// Validation for creating a new message
const createMessageValidator = [
  body('recipientId')
    .notEmpty().withMessage('Recipient ID is required')
    .isMongoId().withMessage('Invalid recipient ID format'),
  
  body('content')
    .notEmpty().withMessage('Message content is required')
    .isString().withMessage('Message content must be a string')
    .isLength({ min: 1, max: 2000 }).withMessage('Message content must be between 1 and 2000 characters'),
  
  body('attachments')
    .optional()
    .isArray().withMessage('Attachments must be an array'),
  
  validate
];

// Validation for adding an attachment
const attachmentValidator = [
  body('attachmentUrl')
    .notEmpty().withMessage('Attachment URL is required')
    .isURL().withMessage('Invalid URL format'),
  
  validate
];

module.exports = {
  createMessageValidator,
  attachmentValidator
};