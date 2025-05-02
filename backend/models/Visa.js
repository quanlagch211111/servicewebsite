const mongoose = require('mongoose');

const visaSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['BUSINESS', 'TOURIST', 'GUARANTOR'], 
    required: true 
  },
  applicant: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Users', 
    required: true 
  },
  destination: { type: String, required: true },
  purpose: { type: String, required: true },
  applicationDetails: {
    passportNumber: { type: String, required: true },
    issueDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    appliedDate: { type: Date, default: Date.now },
    entryType: { 
      type: String, 
      enum: ['SINGLE', 'MULTIPLE', 'TRANSIT'] 
    },
    durationOfStay: { type: Number } // in days
  },
  status: { 
    type: String, 
    enum: ['SUBMITTED', 'PROCESSING', 'APPROVED', 'REJECTED', 'ADDITIONAL_INFO_REQUIRED'], 
    default: 'SUBMITTED' 
  },
  documents: [{ type: String }],
  notes: { type: String },
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Users' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Visa', visaSchema);