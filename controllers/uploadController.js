const cloudinary = require('../config/cloudinary');

/**
 * @desc    Upload image to Cloudinary
 * @route   POST /api/upload
 * @access  Private
 */
exports.uploadImage = async (req, res) => {
  try {
    const { image, folder = 'campusconnect' } = req.body;

    if (!image) {
      return res.status(400).json({ message: 'No image provided' });
    }

    // Validate base64 format
    if (!image.startsWith('data:image')) {
      return res.status(400).json({ message: 'Invalid image format. Must be base64 data URL.' });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(image, {
      folder: folder,
      resource_type: 'image',
      transformation: [
        { width: 1024, height: 1024, crop: 'limit' }, // Limit max size
        { quality: 'auto:good' }, // Auto optimize quality
        { fetch_format: 'auto' } // Auto format (webp for supported browsers)
      ]
    });

    res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id
    });

  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    res.status(500).json({ 
      message: 'Image upload failed',
      error: error.message 
    });
  }
};

/**
 * @desc    Delete image from Cloudinary
 * @route   DELETE /api/upload/:publicId
 * @access  Private
 */
exports.deleteImage = async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({ message: 'Public ID required' });
    }

    await cloudinary.uploader.destroy(publicId);

    res.json({ success: true, message: 'Image deleted' });

  } catch (error) {
    console.error('Cloudinary Delete Error:', error);
    res.status(500).json({ message: 'Failed to delete image' });
  }
};
