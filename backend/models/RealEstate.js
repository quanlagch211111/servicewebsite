const mongoose = require('mongoose');

const realEstateSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['RENTAL', 'PURCHASE', 'BDS_INVESTMENT'],
    required: true 
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  location: { 
    address: { type: String, required: true },
    city: { type: String, required: true },
    district: { type: String },
    coordinates: {
      latitude: { type: Number },
      longitude: { type: Number }
    }
  },
  features: {
    area: { type: Number },
    bedrooms: { type: Number },
    bathrooms: { type: Number },
    floors: { type: Number },
    amenities: [{ type: String }]
  },
  images: [{ type: String }],
  status: { 
    type: String, 
    enum: ['AVAILABLE', 'PENDING', 'SOLD', 'RENTED'],
    default: 'AVAILABLE' 
  },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Users', required: true },
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'Users' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RealEstate', realEstateSchema);