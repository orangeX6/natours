const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  //  Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: { user },
  });
};

//>> SIGN UP
exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
    // role: req.body.role,
  });

  const url = `${req.protocol}://${req.get('host')}/me`;
  console.log(url);
  await new Email(newUser, url).sendWelcome();

  createSendToken(newUser, 201, res);
});

//>> SIGN IN
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exists
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }

  // 2) Check if user exists
  const user = await User.findOne({ email }).select(
    '+password +loginAttempts +isBlocked +unblockTime'
  );

  // 3) Check if user is allowed to login
  if (user) {
    const timeToUnBlock = await user.isLoginBlocked();
    if (user.isBlocked) {
      return next(
        new AppError(
          `Too many incorrect login attempts. Please wait for ${Math.floor(
            timeToUnBlock / 60000
          )} minutes ${Math.floor(
            (timeToUnBlock % 60000) / 1000
          )} seconds before trying again`
        )
      );
    }
  }

  //  4) Check if user exists and password is correct. Update login attempts
  if (!user || !(await user.correctPassword(password, user.password))) {
    if (user) await user.incorrectLogin(true);
    return next(new AppError('Incorrect email or password', 401));
  }
  await user.incorrectLogin(false);

  //  5) If everything is okay, send token to client
  createSendToken(user, 200, res);
});

//>> LOGOUT
exports.logout = (req, res) => {
  res.cookie('jwt', 'null', {
    expires: new Date(Date.now() - 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({
    status: 'success',
  });
};

//>> PROTECT UNAUTHORIZED USE
exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of its existence
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  // console.log(token);

  if (!token)
    return next(
      new AppError('You are not logged in! Please log in to proceed', 401)
    );

  // 2) Verification token (JsonWebTokenError or TokenExpiredError)
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser)
    return next(
      new AppError('The user belonging to this token does no longer exist', 401)
    );

  // 4) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        'Your password was changed recently. Please log in again!',
        401
      )
    );
  }
  //  GRANT ACCESS TO PROTECTED ROUTE
  // console.log('Current user 🤯🤯🤯🤯', currentUser, currentUser.id);
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

//>> CHECK IF LOGGED IN
//  Only for rendered pages, no error
exports.isLoggedIn = catchAsync(async (req, res, next) => {
  if (req.cookies.jwt) {
    // 1) Verify token
    const decoded = await promisify(jwt.verify)(
      req.cookies.jwt,
      process.env.JWT_SECRET
    );

    // 2) Check if user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) return next();

    // 3) Check if user changed password after the token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return next();
    }
    // THERE IS A LOGGED IN USER
    res.locals.user = currentUser;
    return next();
  }
  next();
});

//>> Use this in case there are errors ahead
// exports.isLoggedIn = async (req, res, next) => {
//   if (req.cookies.jwt) {
//     try {
//       // 1) Verify token
//       const decoded = await promisify(jwt.verify)(
//         req.cookies.jwt,
//         process.env.JWT_SECRET
//       );

//       // 2) Check if user still exists
//       const currentUser = await User.findById(decoded.id);
//       if (!currentUser) return next();

//       // 3) Check if user changed password after the token was issued
//       if (currentUser.changedPasswordAfter(decoded.iat)) {
//         return next();
//       }
//       // THERE IS A LOGGED IN USER
//       res.locals.user = currentUser;
//       return next();
//     } catch (err) {
//       return next();
//     }
//   }

//   next();
// };

//>> RESTRICT TO AUTHORIZED USERS
// eslint-disable-next-line arrow-body-style
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'lead-guide']
    if (!roles.includes(req.user.role))
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );

    next();
  };
};

//>> FORGOT PASSWORD
exports.forgotPassword = catchAsync(async (req, res, next) => {
  //  1)  Get user based on posted email
  const user = await User.findOne({ email: req.body.email });
  // console.log(req.body);
  if (!user) return next(new AppError('No user found. Please try again', 404));

  //  2)  Generate a random password reset token
  const resetToken = user.createPasswordResetToken();

  // console.log(user);
  await user.save({ validateBeforeSave: false });

  try {
    //  3)  Send it to user's email
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;

    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500
      )
    );
  }
});

//>> RESET PASSWORD
exports.resetPassword = catchAsync(async (req, res, next) => {
  //  1)  Get user based on token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // console.log(user);

  //  2)  If token has not expired, and there is user, set the new password
  if (!user) return next(new AppError('Token is invalid or has expired.', 400));

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  //  3) Update changedPasswordAt property for the user
  //  4)  Log the user in, send JWT
  createSendToken(user, 200, res);
});

//>> UPDATE PASSWORD
exports.updatePassword = catchAsync(async (req, res, next) => {
  //  1)  Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  //  2)  Check if POSTed current password is correct
  const { passwordCurrent } = req.body;
  if (!(await user.correctPassword(passwordCurrent, user.password)))
    return next(new AppError('Your current password is incorrect', 401));

  //  3)  If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  //  4)  Log User In, send jwt
  createSendToken(user, 200, res);
});
