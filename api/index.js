const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const serverApp = require('../server/index.js');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Use the server app
app.use('/', serverApp);

// Export the Express API
module.exports = app; 