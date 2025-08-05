// Load environment variables from .env file
require('dotenv').config();

// Import required packages
const express = require('express');
const cors = require('cors');
const shopRoutes = require('./shopRoutes');
const authRoutes = require('./authRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const customerRoutes = require('./customerRoutes'); // Import customer routes

// Create an Express application
const app = express();

// Define the port the server will run on
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors()); 
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- API Routes ---
app.use('/api', shopRoutes);
app.use('/api/auth', authRoutes); // For barber shops
app.use('/api/customers', customerRoutes); // For customers
app.use('/api/dashboard', dashboardRoutes);

// --- Server Startup ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
