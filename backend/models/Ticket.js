const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['REAL_ESTATE', 'INSURANCE', 'VISA', 'TAX', 'GENERAL'],
    required: true 
  },
  priority: { 
    type: String, 
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], 
    default: 'MEDIUM' 
  },
  status: { 
    type: String, 
    enum: ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'], 
    default: 'OPEN' 
  },
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Users', 
    required: true 
  },
  assignedTo: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Users' 
  },
  relatedService: {
    serviceType: { 
      type: String, 
      enum: ['REAL_ESTATE', 'INSURANCE', 'VISA', 'TAX'] 
    },
    serviceId: { 
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'relatedService.serviceType'
    }
  },
  messages: [{
    sender: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Users', 
      required: true 
    },
    content: { type: String, required: true },
    attachments: [{ type: String }],
    timestamp: { type: Date, default: Date.now }
  }],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Ticket', ticketSchema);