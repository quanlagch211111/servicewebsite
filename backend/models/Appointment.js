const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  serviceType: { 
    type: String, 
    enum: ['REAL_ESTATE', 'INSURANCE', 'VISA', 'TAX', 'OTHER'],
    required: true 
  },
  serviceId: { 
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'serviceType'
  },
  client: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Users', 
    required: true 
  },
  staff: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Users', 
    required: true 
  },
  location: { type: String },
  status: { 
    type: String, 
    enum: ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'],
    default: 'SCHEDULED' 
  },
  reminders: [{
    time: { type: Date },
    sent: { type: Boolean, default: false }
  }],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Appointment', appointmentSchema);