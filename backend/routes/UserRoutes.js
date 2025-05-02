const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const { upload } = require('../services/UploadService');
const { authMiddleware, isAdmin, checkRole } = require('../middleware/Auth');
const { 
  userRegisterValidator, 
  userLoginValidator, 
  passwordChangeValidator 
} = require('../services/Validators');

// Public routes
router.get('/', authMiddleware(), UserController.getAllUsers);
router.post('/register', userRegisterValidator, UserController.register);
router.post('/login', userLoginValidator, UserController.login);
router.post('/forgot-password', UserController.forgotPassword);
router.post('/reset-password', UserController.resetPassword);
router.post('/refresh-token', UserController.refreshToken);

// Protected routes - require authentication
router.get('/profile', authMiddleware(), UserController.getProfile);
router.put('/profile', authMiddleware(), UserController.updateProfile);
router.put('/change-password', authMiddleware(), passwordChangeValidator, UserController.changePassword);

// Admin routes
router.get('/all', authMiddleware(), isAdmin, UserController.getAllUsers);
router.get('/:id', authMiddleware(), isAdmin, UserController.getUserById);
router.put('/:id', authMiddleware(), isAdmin, UserController.updateUser);
router.delete('/:id', authMiddleware(), isAdmin, UserController.deleteUser);

// Support staff routes - can view users but not modify admin status
router.get(
  '/support/users', 
  authMiddleware(), 
  checkRole(['ADMIN', 'SUPPORT']), 
  UserController.getAllUsers
);

// Avatar upload route
router.post('/avatar', 
  authMiddleware(), 
  upload.single('avatar'), 
  UserController.uploadAvatar
);

router.get('/admin/statistics', 
  authMiddleware(), 
  isAdmin, 
  UserController.getUserStatistics
);

module.exports = router;