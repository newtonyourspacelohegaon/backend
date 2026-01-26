const express = require('express');
const router = express.Router();
const { 
  createStory, 
  getStories, 
  viewStory, 
  archiveStory,
  getArchivedStories 
} = require('../controllers/storyController');
const { protect } = require('../middleware/authMiddleware');

// All routes are protected
router.use(protect);

router.route('/')
  .get(getStories)
  .post(createStory);

router.get('/archive', getArchivedStories);
router.post('/:id/view', viewStory);
router.delete('/:id', archiveStory);

module.exports = router;
