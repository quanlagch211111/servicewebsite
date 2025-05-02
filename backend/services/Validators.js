const userRegisterValidator = (req, res, next) => {
    const { username, email, password } = req.body;
    let errors = [];
  
    // Check username
    if (!username) {
      errors.push('Username is required');
    } else if (username.length < 3 || username.length > 30) {
      errors.push('Username must be between 3 and 30 characters');
    }
  
    // Check email
    if (!email) {
      errors.push('Email is required');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push('Email format is invalid');
      }
    }
  
    // Check password
    if (!password) {
      errors.push('Password is required');
    } else if (password.length < 6) {
      errors.push('Password must be at least 6 characters');
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
  
  const userLoginValidator = (req, res, next) => {
    const { email, password } = req.body;
    let errors = [];
  
    // Check email
    if (!email) {
      errors.push('Email is required');
    }
  
    // Check password
    if (!password) {
      errors.push('Password is required');
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
  
  const passwordChangeValidator = (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    let errors = [];
  
    // Check passwords
    if (!currentPassword) {
      errors.push('Current password is required');
    }
  
    if (!newPassword) {
      errors.push('New password is required');
    } else if (newPassword.length < 6) {
      errors.push('New password must be at least 6 characters');
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
    userRegisterValidator,
    userLoginValidator,
    passwordChangeValidator
  };