import jwt from "jsonwebtoken";
import AppError from "../errors/appError.js";
import { User } from "../models/user.model.js";
import catchAsync from "../utility/catchAsync.js";

export const isAuthenticated = catchAsync(async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return next(new AppError(401, "Authentication required"));

  const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  const user = await User.findById(decoded.id).select("-password -refreshToken");
  if (!user) return next(new AppError(401, "User not found"));
  if (user.isBanned) return next(new AppError(403, "Your account has been banned"));

  req.user = user;
  next();
});

export const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.accountType)) {
    return next(new AppError(403, "Access denied"));
  }
  next();
};
