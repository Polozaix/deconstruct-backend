const express = require('express');
const router = express.Router();
const { handleDeconstruct, getTask, getHistory, updateItemStatus, deleteTask } = require('../controllers/aiController');

// Core flow: problem -> smaller problems -> routine
router.post('/deconstruct', handleDeconstruct);

// Retrieve breakdowns
router.get('/task/:taskId', getTask);
router.get('/history', getHistory);

// Update a single step (mark done / pending)
router.patch('/item/:itemId', updateItemStatus);

// Remove a breakdown and its steps
router.delete('/task/:taskId', deleteTask);

module.exports = router;