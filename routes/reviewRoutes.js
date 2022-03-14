const express = require('express');
const reviewController = require('../controllers/reviewController');
const authController = require('../controllers/authController');

// By default each router only has access to the parameters of their specific routes. In order to get access to tourId we need to merge the parameters and we specify that in options on Router
const router = express.Router({ mergeParams: true });

router.use(authController.protect);

// POST /tour/234fad4/reviews
// GET /tour/234fad4/reviews
// POST /reviews
router
  .route('/')
  .get(reviewController.getAllReviews)
  .post(
    authController.restrictTo('user'),
    reviewController.setTourUserIds,
    reviewController.createReview
  );

router
  .route('/:id')
  .get(reviewController.getReview)
  .patch(
    authController.restrictTo('user', 'admin'),
    reviewController.updateReview
  )
  .delete(
    authController.restrictTo('user', 'admin'),
    reviewController.deleteReview
  );

module.exports = router;
