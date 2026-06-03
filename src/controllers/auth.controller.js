import jwt from "jsonwebtoken";
import catchAsync from "../utility/catchAsync.js";
import AppError from "../errors/appError.js";
import { sendResponse, generateVerificationCode, sendVerificationCode, sendPasswordResetCode } from "../utility/helper.js";
import { isValidEmail, isStrongPassword } from "../utility/validation_check.js";
import { User } from "../models/user.model.js";

const signToken = (id, secret, expiry) =>
  jwt.sign({ id }, secret, { expiresIn: expiry });

const generateTokens = (userId) => ({
  accessToken: signToken(userId, process.env.JWT_ACCESS_SECRET, process.env.ACCESS_TOKEN_EXPIRY || "7d"),
  refreshToken: signToken(userId, process.env.JWT_REFRESH_SECRET, process.env.REFRESH_TOKEN_EXPIRY || "10d"),
});

export const register = catchAsync(async (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return next(new AppError(400, "Name, email and password are required"));
  if (!isValidEmail(email))
    return next(new AppError(400, "Invalid email format"));
  if (!isStrongPassword(password))
    return next(new AppError(400, "Password must be at least 8 characters with uppercase, lowercase, number and special character"));

  const existing = await User.findOne({ email });
  if (existing) return next(new AppError(400, "Email already registered"));

  const code = generateVerificationCode();
  const expiry = new Date(Date.now() + 10 * 60 * 1000);

  const user = await User.create({
    name,
    email,
    password,
    verificationCode: code,
    verificationCodeExpiry: expiry,
  });

  await sendVerificationCode(email, code);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Registration successful. Please verify your email.",
    data: { userId: user._id },
  });
});

export const verifyEmail = catchAsync(async (req, res, next) => {
  const { userId, code } = req.body;
  if (!userId || !code) return next(new AppError(400, "userId and code are required"));

  const user = await User.findById(userId);
  if (!user) return next(new AppError(404, "User not found"));
  if (user.isVerified) return next(new AppError(400, "Email already verified"));
  if (user.verificationCode !== code) return next(new AppError(400, "Invalid verification code"));
  if (new Date() > user.verificationCodeExpiry) return next(new AppError(400, "Verification code expired"));

  user.isVerified = true;
  user.verificationCode = "";
  user.verificationCodeExpiry = null;
  await user.save();

  sendResponse(res, { statusCode: 200, success: true, message: "Email verified successfully", data: null });
});

export const resendVerification = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  if (!email) return next(new AppError(400, "Email is required"));

  const user = await User.findOne({ email });
  if (!user) return next(new AppError(404, "User not found"));
  if (user.isVerified) return next(new AppError(400, "Email already verified"));

  const code = generateVerificationCode();
  user.verificationCode = code;
  user.verificationCodeExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();
  await sendVerificationCode(email, code);

  sendResponse(res, { statusCode: 200, success: true, message: "Verification code resent", data: null });
});

export const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) return next(new AppError(400, "Email and password are required"));

  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password)))
    return next(new AppError(401, "Invalid email or password"));
  if (!user.isVerified) return next(new AppError(403, "Please verify your email first"));
  if (user.isBanned) return next(new AppError(403, "Your account has been banned"));

  const { accessToken, refreshToken } = generateTokens(user._id);
  user.refreshToken = refreshToken;
  await user.save();

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Login successful",
    data: {
      accessToken,
      refreshToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        accountType: user.accountType,
        isVerified: user.isVerified,
      },
    },
  });
});

export const refreshToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return next(new AppError(400, "Refresh token required"));

  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  const user = await User.findById(decoded.id);
  if (!user || user.refreshToken !== refreshToken)
    return next(new AppError(401, "Invalid refresh token"));

  const tokens = generateTokens(user._id);
  user.refreshToken = tokens.refreshToken;
  await user.save();

  sendResponse(res, { statusCode: 200, success: true, message: "Token refreshed", data: tokens });
});

export const logout = catchAsync(async (req, res, next) => {
  req.user.refreshToken = "";
  await req.user.save();
  sendResponse(res, { statusCode: 200, success: true, message: "Logged out successfully", data: null });
});

export const forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  if (!email) return next(new AppError(400, "Email is required"));

  const user = await User.findOne({ email });
  if (!user) return next(new AppError(404, "No user with that email"));

  const code = generateVerificationCode();
  user.passwordResetCode = code;
  user.passwordResetCodeExpiry = new Date(Date.now() + 10 * 60 * 1000);
  await user.save();
  await sendPasswordResetCode(email, code);

  sendResponse(res, { statusCode: 200, success: true, message: "Password reset code sent to email", data: null });
});

export const resetPassword = catchAsync(async (req, res, next) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword)
    return next(new AppError(400, "Email, code and newPassword are required"));
  if (!isStrongPassword(newPassword))
    return next(new AppError(400, "Password must be at least 8 characters with uppercase, lowercase, number and special character"));

  const user = await User.findOne({ email });
  if (!user) return next(new AppError(404, "User not found"));
  if (user.passwordResetCode !== code) return next(new AppError(400, "Invalid reset code"));
  if (new Date() > user.passwordResetCodeExpiry) return next(new AppError(400, "Reset code expired"));

  user.password = newPassword;
  user.passwordResetCode = "";
  user.passwordResetCodeExpiry = null;
  user.refreshToken = "";
  await user.save();

  sendResponse(res, { statusCode: 200, success: true, message: "Password reset successful", data: null });
});

export const changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return next(new AppError(400, "Current and new password are required"));
  if (!isStrongPassword(newPassword))
    return next(new AppError(400, "Password must be at least 8 characters with uppercase, lowercase, number and special character"));

  const user = await User.findById(req.user._id);
  if (!(await user.comparePassword(currentPassword)))
    return next(new AppError(400, "Current password is incorrect"));

  user.password = newPassword;
  await user.save();

  sendResponse(res, { statusCode: 200, success: true, message: "Password changed successfully", data: null });
});
