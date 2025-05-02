const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Users', 
    required: true 
  },
  recipient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Users', 
    required: true 
  },
  content: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  attachments: [{ type: String }],
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Message', messageSchema);