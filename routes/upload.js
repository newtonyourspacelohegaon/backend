const express = require('express');
const router = express.Router();
const { uploadImage, deleteImage } = require('../controllers/uploadController');
const { protect } = require('../middleware/authMiddleware');

// All routes are protected
router.post('/', protect, uploadImage);
router.delete('/:publicId', protect, deleteImage);

module.exports = router;
