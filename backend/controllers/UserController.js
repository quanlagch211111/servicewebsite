const User = require('../models/User');
const JwtService = require('../services/JwtService');
const EmailService = require('../services/EmailService');
const UploadService = require('../services/UploadService');
const bcrypt = require('bcrypt');

// Register new user
const register = async (req, res) => {
  try {
    const { username, email, password, address, phone } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username or email already exists' 
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user with hashed password
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      address,
      phone,
      role: 'USER',
      lastLogin: Date.now()
    });

    const savedUser = await newUser.save();
    await EmailService.sendWelcomeEmail(savedUser);
    await EmailService.sendUserRegistrationNotification(savedUser);

    // Generate tokens
    const payload = { 
      id: savedUser._id, 
      role: savedUser.role, 
      isAdmin: savedUser.isAdmin 
    };
    
    const accessToken = await JwtService.generalAccessToken(payload);
    const refreshToken = await JwtService.generalRefreshToken(payload);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: savedUser._id,
        username: savedUser.username,
        email: savedUser.email,
        role: savedUser.role
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save();

    // Generate tokens
    const payload = {
      id: user._id,
      role: user.role,
      isAdmin: user.isAdmin
    };
    
    const accessToken = await JwtService.generalAccessToken(payload);
    const refreshToken = await JwtService.generalRefreshToken(payload);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
        avatar: user.avatar
      },
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.payload.id;
    
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.payload.id;
    const { username, address, phone, avatar, preferences } = req.body;
    
    // Check if username is taken if it's being updated
    if (username) {
      const existingUser = await User.findOne({ 
        username, 
        _id: { $ne: userId } 
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken'
        });
      }
    }

    // Build update object with only provided fields
    const updateData = {};
    if (username) updateData.username = username;
    if (address) updateData.address = address;
    if (phone) updateData.phone = phone;
    if (avatar) updateData.avatar = avatar;
    if (preferences) {
      updateData.preferences = {
        ...(req.user.preferences || {}),
        ...preferences
      };
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const userId = req.user.payload.id;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
};

// Forgot password - request reset
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User with this email does not exist'
      });
    }

    // Generate reset token
    const payload = { id: user._id };
    const resetToken = await JwtService.generalResetPasswordToken(payload);

    await EmailService.sendPasswordResetEmail(user, resetToken);
    // For now, just return it in the response
    
    res.status(200).json({
      success: true,
      message: 'Password reset link sent to your email',
      resetToken // In production, don't include this in the response
    });
  } catch (error) {
    console.error('Error in forgot password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process password reset request',
      error: error.message
    });
  }
};

// Reset password with token
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Verify token
    const decoded = await JwtService.verifyToken(
      token, 
      process.env.PASSWORD_RESET_TOKEN
    ).catch(() => {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    });

    // Get user from token
    const userId = decoded.payload.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error('Error in reset password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: error.message
    });
  }
};

// Refresh token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    const result = await JwtService.provideToken(refreshToken);
    
    if (result.status === 'ERROR') {
      return res.status(401).json({
        success: false,
        message: result.message
      });
    }

    res.status(200).json({
      success: true,
      accessToken: result.accessToken
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh token',
      error: error.message
    });
  }
};

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    
    res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

// Get user by ID (admin only)
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
};

// Update user (admin only)
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role, isAdmin, address, phone, avatar, preferences } = req.body;
    
    // Build update object
    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (isAdmin !== undefined) updateData.isAdmin = isAdmin;
    if (address) updateData.address = address;
    if (phone) updateData.phone = phone;
    if (avatar) updateData.avatar = avatar;
    if (preferences) updateData.preferences = preferences;

    const updatedUser = await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
};

// Delete user (admin only)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
};

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const userId = req.user.payload.id;
    
    // Get the URL for the uploaded file
    const avatarUrl = UploadService.getFileUrl(req, req.file.path);
    
    // Update user's avatar in database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { avatar: avatarUrl, updated_at: Date.now() },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      // Delete uploaded file if user not found
      UploadService.deleteFile(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Avatar uploaded successfully',
      user: updatedUser
    });
  } catch (error) {
    // Delete uploaded file if error occurs
    if (req.file) {
      UploadService.deleteFile(req.file.path);
    }
    
    console.error('Error uploading avatar:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload avatar',
      error: error.message
    });
  }
};

const getUserStatistics = async (req, res) => {
  try {
    // Get total users
    const total = await User.countDocuments();
    
    // Get users created in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsers = await User.countDocuments({ created_at: { $gte: thirtyDaysAgo } });
    
    // Get active users
    const active = await User.countDocuments({ isActive: true });
    
    // Get user counts by role
    const admins = await User.countDocuments({ role: 'ADMIN' });
    const agents = await User.countDocuments({ role: 'AGENT' });
    const support = await User.countDocuments({ role: 'SUPPORT' });
    const customers = await User.countDocuments({ role: 'USER' });
    
    res.status(200).json({
      success: true,
      stats: {
        total,
        new: newUsers,
        active,
        admins,
        agents,
        support,
        customers
      }
    });
  } catch (error) {
    console.error('Error getting user statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user statistics',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  refreshToken,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  uploadAvatar,
  getUserStatistics
};