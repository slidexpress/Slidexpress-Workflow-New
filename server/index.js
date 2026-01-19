// index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const compression = require('compression');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(compression()); // Enable gzip compression for ALL responses
app.use(express.json({ limit: '50mb' })); // Increase limit for large payloads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI) // no useNewUrlParser / useUnifiedTopology
  .then(() => console.log('🚀 MongoDB Connected Successfully'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/otp', require('./routes/otp'));
app.use('/api/emails', require('./routes/emails'));
app.use('/api/tickets', require('./routes/tickets')); // Tickets API
app.use('/api/team-members', require('./routes/teamMembers')); // Team Members API

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Slidexpress Workflow API' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
