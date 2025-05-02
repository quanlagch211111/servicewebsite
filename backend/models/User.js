const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true }, 
  password: { type: String, required: true },
  address: { type: String },
  phone: { type: String },
  avatar: { type: String },
  role: { 
    type: String, 
    enum: ['USER', 'ADMIN', 'SUPPORT', 'AGENT'], 
    default: 'USER' 
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  isAdmin: { type: Boolean, default: false },
  preferences: {
    language: { type: String, default: 'en' },
    notifications: { type: Boolean, default: true }
  },
  lastLogin: { type: Date },
});

userSchema.pre('save', function(next) {
  this.updated_at = Date.now();
  next();
});

module.exports = mongoose.model('Users', userSchema);