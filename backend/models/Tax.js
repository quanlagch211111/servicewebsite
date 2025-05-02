const mongoose = require('mongoose');

const taxSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['INCOME_TAX', 'PROPERTY_TAX', 'TAX_RETURN', 'TAX_CONSULTATION'], 
    required: true 
  },
  client: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Users', 
    required: true 
  },
  fiscalYear: { type: String, required: true },
  details: {
    totalIncome: { type: Number },
    totalDeductions: { type: Number },
    totalTaxDue: { type: Number },
    filingDeadline: { type: Date }
  },
  status: { 
    type: String, 
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REVISION_NEEDED'], 
    default: 'PENDING' 
  },
  documents: [{ type: String }],
  notes: { type: String },
  taxProfessional: { type: mongoose.Schema.Types.ObjectId, ref: 'Users' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tax', taxSchema);