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

// Validator for requesting an appointment
const appointmentRequestValidator = [
  body('title')
    .notEmpty().withMessage('Title is required')
    .isString().withMessage('Title must be a string')
    .isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters'),
  
  body('description')
    .optional()
    .isString().withMessage('Description must be a string'),
  
  body('startTime')
    .notEmpty().withMessage('Start time is required')
    .isISO8601().withMessage('Start time must be a valid date')
    .custom((value) => {
      const now = new Date();
      const startTime = new Date(value);
      if (startTime <= now) {
        throw new Error('Start time must be in the future');
      }
      return true;
    }),
  
  body('endTime')
    .notEmpty().withMessage('End time is required')
    .isISO8601().withMessage('End time must be a valid date')
    .custom((value, { req }) => {
      const startTime = new Date(req.body.startTime);
      const endTime = new Date(value);
      if (endTime <= startTime) {
        throw new Error('End time must be after start time');
      }
      return true;
    }),
  
  body('serviceType')
    .notEmpty().withMessage('Service type is required')
    .isIn(['REAL_ESTATE', 'INSURANCE', 'VISA', 'TAX', 'OTHER']).withMessage('Invalid service type'),
  
  body('serviceId')
    .optional()
    .isMongoId().withMessage('Invalid service ID format'),
  
  body('location')
    .optional()
    .isString().withMessage('Location must be a string'),
  
  validate
];

// Validator for updating an appointment
const appointmentUpdateValidator = [
  body('title')
    .optional()
    .isString().withMessage('Title must be a string')
    .isLength({ min: 3, max: 100 }).withMessage('Title must be between 3 and 100 characters'),
  
  body('description')
    .optional()
    .isString().withMessage('Description must be a string'),
  
  body('startTime')
    .optional()
    .isISO8601().withMessage('Start time must be a valid date'),
  
  body('endTime')
    .optional()
    .isISO8601().withMessage('End time must be a valid date')
    .custom((value, { req }) => {
      if (req.body.startTime) {
        const startTime = new Date(req.body.startTime);
        const endTime = new Date(value);
        if (endTime <= startTime) {
          throw new Error('End time must be after start time');
        }
      }
      return true;
    }),
  
  body('location')
    .optional()
    .isString().withMessage('Location must be a string'),
  
  body('status')
    .optional()
    .isIn(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']).withMessage('Invalid status'),
  
  body('staff')
    .optional()
    .isMongoId().withMessage('Invalid staff ID format'),
  
  validate
];

// Validator for changing appointment status
const statusValidator = [
  body('status')
    .notEmpty().withMessage('Status is required')
    .isIn(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED']).withMessage('Invalid status'),
  
  body('notes')
    .optional()
    .isString().withMessage('Notes must be a string'),
  
  validate
];

module.exports = {
  appointmentRequestValidator,
  appointmentUpdateValidator,
  statusValidator
};