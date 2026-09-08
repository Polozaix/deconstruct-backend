// 1. Import dependencies
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// 2. Initialize the Express app
const app = express();

// 3. Middleware
app.use(cors());
app.use(express.json());

// 4. Serve the frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// 5. API routes
const apiRoutes = require('./routes/apiRoutes');
app.use('/api', apiRoutes);

// 6. Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Deconstruct.ai server running on http://localhost:${PORT}`);
});

module.exports = app;