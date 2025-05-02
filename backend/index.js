const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const userRoutes = require('./routes/UserRoutes');
const realEstateRoutes = require('./routes/RealEstateRoutes');
const insuranceRoutes = require('./routes/InsuranceRoutes');
const visaRoutes = require('./routes/VisaRoutes');
const taxRoutes = require('./routes/TaxRoutes');
const ticketRoutes = require('./routes/TicketRoutes');
const messageRoutes = require('./routes/MessageRoutes');
const appointmentRoutes = require('./routes/AppointmentRoutes');
const AppointmentScheduler = require('./services/AppointmentScheduler');




dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/real-estate', realEstateRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/visa', visaRoutes);
app.use('/api/tax', taxRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/appointments', appointmentRoutes);
// Add other routes as needed

// Default route
app.get('/', (req, res) => {
  res.send('API is running');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
});

setInterval(AppointmentScheduler.sendAppointmentReminders, 60 * 60 * 1000);
AppointmentScheduler.sendAppointmentReminders();
// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});