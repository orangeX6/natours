const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please enter your name!'],
  },
  email: {
    type: String,
    required: [true, 'Please provide your email'],
    lowercase: true,
    unique: true,
    validate: [
      validator.isEmail,
      'Incorrect email id. Please provide a valid email',
    ],
  },
  photo: {
    type: String,
    default: 'default.jpg',
  },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user',
  },
  password: {
    type: String,
    required: [true, ''],
    minLength: [8, 'A password must be at least 8 characters long'],
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      //ONLY WORKS ON CREATE and SAVE and not on UPDATE
      validator: function (val) {
        return this.password === val;
      },
      message: 'Password do not match',
    },
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
  loginAttempts: {
    type: Number,
    select: false,
    default: 0,
  },
  isBlocked: {
    type: Boolean,
    select: false,
    default: false,
  },
  unblockTime: Date,
});

userSchema.pre('save', async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();

  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);

  // Delete password confirm field
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.pre(/^find/, function (next) {
  //this points to current query
  this.find({ active: { $ne: false } });
  next();
});

//this.password won't be available since we have set select:false for password. So we need to pass the user password
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );

    return JWTTimestamp < changedTimestamp;
  }

  //False means NOT changed
  return false;
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // console.log({ resetToken }, this.passwordResetToken);

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

userSchema.methods.isLoginBlocked = async function () {
  //  1) Time to unblock
  let timeRemaining;
  if (this.isBlocked) {
    timeRemaining = this.unblockTime - Date.now();
  }

  //  2) Unblock if blocking past time
  if (timeRemaining < 0) {
    this.isBlocked = false;
    this.loginAttempts = 0;
    this.unblockTime = undefined;
    this.save({ validateBeforeSave: false });
  }

  //  3) return time to unblock for error handling
  return timeRemaining;
};

userSchema.methods.incorrectLogin = async function (incorrect) {
  // Update login counter, if login was incorrect
  if (incorrect) this.loginAttempts += 1;
  else this.loginAttempts = 0;

  if (this.loginAttempts >= 3) {
    this.isBlocked = true;
    this.unblockTime = Date.now() + 10 * 60 * 1000;
  }

  await this.save({ validateBeforeSave: false });
};

const User = mongoose.model('User', userSchema);

module.exports = User;
