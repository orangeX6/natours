const Tour = require('../models/tourModel');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

exports.getOverview = catchAsync(async (req, res, next) => {
  //  1) Get Tour Data from Collection
  const tours = await Tour.find();

  //  2) Build Template
  //  in overview.pug

  //  3) Render that Template using tour data from 1
  res.status(200).render('overview', {
    title: 'All Tours',
    tours,
  });
});

exports.getTour = catchAsync(async (req, res, next) => {
  //  1) Get the data, for the requested tour (including reviews and guides)
  const tour = await Tour.findOne({ slug: req.params.slug }).populate({
    path: 'reviews',
    select: 'review rating user',
  });

  if (!tour) {
    return next(new AppError(`There is no tour with that name.`, 404));
  }

  //  2) Build Template
  //  in tour.pug

  //  3) Render template using data from 1)
  res.status(200).render('tour', {
    title: tour.name,
    tour,
  });
});

exports.getLoginForm = (req, res) => {
  res.status(200).render('login', {
    title: 'Login',
  });
};

exports.getSignUpForm = (req, res) => {
  res.status(200).render('signup', {
    title: 'Sign Up',
  });
};

exports.getAccount = (req, res) => {
  res.status(200).render('account', {
    title: 'Your account',
  });
};

exports.updateUserData = catchAsync(async (req, res, next) => {
  // console.log('UPDATING USER 👻👻👻👻', req.body);
  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    {
      name: req.body.name,
      email: req.body.email,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  res.status(200).render('account', {
    title: 'Your account',
    user: updatedUser,
  });
});

//   Using pre find hook (215)
exports.getMyTours = catchAsync(async (req, res, next) => {
  //  1) Find all bookings
  const bookings = await Booking.find({ user: req.user.id });

  //  2) Find tours with the returned IDs
  const tourIDs = bookings.map((el) => el.tour);
  const tours = await Tour.find({ _id: { $in: tourIDs } });
  // OR
  // const tours = await Promise.all(
  //   bookings.map(async el => {
  //       return await Tour.findById(el.tour);
  //   })

  res.status(200).render('overview', {
    title: 'My tours',
    tours,
  });
});

//   Using Virtual populate (215)
// exports.getMyTours = catchAsync(async (req, res, next) => {
//   //1) Find all bookings
//   const bookings = await Booking.find({ user: req.user.id }).populate({
//     path: 'tour',
//   });

//   //2) Find tours
//   const tours = await bookings.map((el) => el.tour);

//   res.status(200).render('overview', {
//     title: 'My Tours',
//     tours,
//   });
// });
