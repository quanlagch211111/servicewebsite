// Validator for creating a tax case
const createTaxValidator = (req, res, next) => {
    const { type, fiscalYear, details } = req.body;
    let errors = [];
  
    // Check tax type
    if (!type) {
      errors.push('Tax type is required');
    } else {
      const validTypes = ['INCOME_TAX', 'PROPERTY_TAX', 'TAX_RETURN', 'TAX_CONSULTATION'];
      if (!validTypes.includes(type)) {
        errors.push(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
      }
    }
  
    // Check fiscal year
    if (!fiscalYear) {
      errors.push('Fiscal year is required');
    } else {
      // Validate fiscal year format (YYYY or YYYY-YYYY)
      const fiscalYearRegex = /^(\d{4})(-\d{4})?$/;
      if (!fiscalYearRegex.test(fiscalYear)) {
        errors.push('Fiscal year must be in format YYYY or YYYY-YYYY');
      }
    }
  
    // Check details if provided
    if (details) {
      // Validate totalIncome if provided
      if (details.totalIncome !== undefined && 
          (isNaN(details.totalIncome) || details.totalIncome < 0)) {
        errors.push('Total income must be a non-negative number');
      }
      
      // Validate totalDeductions if provided
      if (details.totalDeductions !== undefined && 
          (isNaN(details.totalDeductions) || details.totalDeductions < 0)) {
        errors.push('Total deductions must be a non-negative number');
      }
      
      // Validate totalTaxDue if provided
      if (details.totalTaxDue !== undefined && 
          isNaN(details.totalTaxDue)) {
        errors.push('Total tax due must be a number');
      }
      
      // Validate filingDeadline if provided
      if (details.filingDeadline) {
        try {
          new Date(details.filingDeadline);
        } catch (e) {
          errors.push('Filing deadline must be a valid date');
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
  
  // Validator for updating a tax case
  const updateTaxValidator = (req, res, next) => {
    const { type, fiscalYear, details, status } = req.body;
    let errors = [];
  
    // Check tax type if provided
    if (type) {
      const validTypes = ['INCOME_TAX', 'PROPERTY_TAX', 'TAX_RETURN', 'TAX_CONSULTATION'];
      if (!validTypes.includes(type)) {
        errors.push(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
      }
    }
  
    // Check fiscal year if provided
    if (fiscalYear) {
      // Validate fiscal year format (YYYY or YYYY-YYYY)
      const fiscalYearRegex = /^(\d{4})(-\d{4})?$/;
      if (!fiscalYearRegex.test(fiscalYear)) {
        errors.push('Fiscal year must be in format YYYY or YYYY-YYYY');
      }
    }
  
    // Check details if provided
    if (details) {
      // Validate totalIncome if provided
      if (details.totalIncome !== undefined && 
          (isNaN(details.totalIncome) || details.totalIncome < 0)) {
        errors.push('Total income must be a non-negative number');
      }
      
      // Validate totalDeductions if provided
      if (details.totalDeductions !== undefined && 
          (isNaN(details.totalDeductions) || details.totalDeductions < 0)) {
        errors.push('Total deductions must be a non-negative number');
      }
      
      // Validate totalTaxDue if provided
      if (details.totalTaxDue !== undefined && 
          isNaN(details.totalTaxDue)) {
        errors.push('Total tax due must be a number');
      }
      
      // Validate filingDeadline if provided
      if (details.filingDeadline) {
        try {
          new Date(details.filingDeadline);
        } catch (e) {
          errors.push('Filing deadline must be a valid date');
        }
      }
    }
  
    // Check status if provided
    if (status) {
      const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REVISION_NEEDED'];
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
    createTaxValidator,
    updateTaxValidator,
    documentValidator
  };