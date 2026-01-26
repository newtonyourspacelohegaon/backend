const Story = require('../models/Story');
const cloudinary = require('../config/cloudinary');

/**
 * @desc    Create a new story (expires in 24h)
 * @route   POST /api/stories
 * @access  Private
 */
exports.createStory = async (req, res) => {
  try {
    const { image } = req.body;

    console.log('📝 Create Story Request Recieved');
    console.log('Image data length:', image ? image.length : 'null');
    console.log('Is base64:', image && image.startsWith('data:'));

    if (!image) {
      return res.status(400).json({ message: 'Image is required' });
    }

    // Upload to Cloudinary stories folder
    let imageUrl = image;
    if (image.startsWith('data:')) {
      console.log('📤 Uploading to Cloudinary...');
      try {
        const result = await cloudinary.uploader.upload(image, {
          folder: 'stories',
          resource_type: 'image',
          transformation: [
            { width: 1080, height: 1920, crop: 'limit' },
            { quality: 'auto:good' }
          ]
        });
        imageUrl = result.secure_url;
        console.log('✅ Cloudinary Upload Success:', imageUrl);
      } catch (uploadError) {
        console.error('❌ Cloudinary Upload Failed:', uploadError);
        throw new Error('Image upload failed: ' + uploadError.message);
      }
    } else {
        console.warn('⚠️ Image is not base64, skipping Cloudinary upload. Received:', image.substring(0, 50) + '...');
    }

    const story = await Story.create({
      user: req.user.id,
      image: imageUrl
    });

    await story.populate('user', 'username fullName profileImage');

    console.log('✅ Story created in DB:', story._id);
    res.status(201).json(story);
  } catch (error) {
    console.error('❌ Create Story Error:', error);
    // Send more specific error message if available
    res.status(500).json({ message: error.message || 'Failed to create story', error: error.toString() });
  }
};

/**
 * @desc    Get all active stories (grouped by user)
 * @route   GET /api/stories
 * @access  Private
 */
exports.getStories = async (req, res) => {
  try {
    const stories = await Story.getActiveStories();

    // Group stories by user
    const groupedStories = {};
    const currentUserId = req.user.id;

    stories.forEach(story => {
      const userId = story.user._id.toString();
      if (!groupedStories[userId]) {
        groupedStories[userId] = {
          user: story.user,
          stories: [],
          hasUnviewed: false,
          isOwnStory: userId === currentUserId
        };
      }
      
      const hasViewed = story.viewers.some(v => v.toString() === currentUserId);
      groupedStories[userId].stories.push({
        _id: story._id,
        image: story.image,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        viewersCount: story.viewers.length,
        hasViewed
      });
      
      if (!hasViewed && userId !== currentUserId) {
        groupedStories[userId].hasUnviewed = true;
      }
    });

    // Convert to array, putting current user's story first
    const result = Object.values(groupedStories);
    result.sort((a, b) => {
      if (a.isOwnStory) return -1;
      if (b.isOwnStory) return 1;
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return 0;
    });

    res.json(result);
  } catch (error) {
    console.error('Get Stories Error:', error);
    res.status(500).json({ message: 'Failed to fetch stories' });
  }
};

/**
 * @desc    Mark story as viewed
 * @route   POST /api/stories/:id/view
 * @access  Private
 */
exports.viewStory = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    // Don't count own views
    if (story.user.toString() === req.user.id) {
      return res.json({ viewed: true });
    }

    // Add viewer if not already viewed
    if (!story.viewers.includes(req.user.id)) {
      story.viewers.push(req.user.id);
      await story.save();
    }

    res.json({ viewed: true, viewersCount: story.viewers.length });
  } catch (error) {
    console.error('View Story Error:', error);
    res.status(500).json({ message: 'Failed to mark story as viewed' });
  }
};

/**
 * @desc    Archive a story (move to archive folder, don't delete)
 * @route   DELETE /api/stories/:id
 * @access  Private (Owner only)
 */
exports.archiveStory = async (req, res) => {
  try {
    const story = await Story.findById(req.params.id);
    
    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }

    // Only owner can archive
    if (story.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Move image to archive folder in Cloudinary
    if (story.image.includes('cloudinary.com')) {
      try {
        // Extract public ID from URL
        const urlParts = story.image.split('/');
        const publicIdWithExt = urlParts.slice(-2).join('/').replace(/\.[^/.]+$/, '');
        
        // Rename/move to archived folder
        await cloudinary.uploader.rename(
          publicIdWithExt,
          `archived_stories/${req.user.id}/${Date.now()}`,
          { overwrite: true }
        );
      } catch (cloudError) {
        console.log('Cloudinary rename failed, continuing with archive:', cloudError.message);
      }
    }

    // Mark as archived in database
    await story.archive();

    res.json({ message: 'Story archived successfully' });
  } catch (error) {
    console.error('Archive Story Error:', error);
    res.status(500).json({ message: 'Failed to archive story' });
  }
};

/**
 * @desc    Get user's archived stories
 * @route   GET /api/stories/archive
 * @access  Private
 */
exports.getArchivedStories = async (req, res) => {
  try {
    const stories = await Story.find({
      user: req.user.id,
      isArchived: true
    }).sort({ archivedAt: -1 });

    res.json(stories);
  } catch (error) {
    console.error('Get Archived Stories Error:', error);
    res.status(500).json({ message: 'Failed to fetch archived stories' });
  }
};
