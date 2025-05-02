const mongoose = require('mongoose');

const insuranceSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['LIFE', 'HEALTH', 'AUTO', 'HOME', 'TRAVEL'], 
    required: true 
  },
  policyNumber: { type: String, unique: true },
  provider: { type: String, required: true },
  policyholder: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Users', 
    required: true 
  },
  beneficiaries: [{
    name: { type: String },
    relationship: { type: String },
    percentage: { type: Number }
  }],
  coverageDetails: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    coverageAmount: { type: Number, required: true },
    premium: { type: Number, required: true },
    paymentFrequency: { 
      type: String, 
      enum: ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'] 
    }
  },
  status: { 
    type: String, 
    enum: ['ACTIVE', 'PENDING', 'EXPIRED', 'CANCELLED'], 
    default: 'PENDING' 
  },
  documents: [{ type: String }],
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Users' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Insurance', insuranceSchema);