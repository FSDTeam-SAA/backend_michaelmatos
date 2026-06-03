import dotenv from "dotenv";
dotenv.config();
import cloudinary from "cloudinary";
import nodemailer from "nodemailer";
import { Notification } from "../models/notification.model.js";

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const sendResponse = (res, { statusCode, success, message, data }) => {
  res.status(statusCode).json({ statusCode, success, message, data });
};

export const uploadOnCloudinary = (fileBuffer, options = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.v2.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    stream.end(fileBuffer);
  });

export const generateVerificationCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

export const sendVerificationCode = async (email, code) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Email Verification — TravelApp",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#FF6B35">Verify your email</h2>
      <p>Your verification code is:</p>
      <h1 style="letter-spacing:8px;color:#FF6B35">${code}</h1>
      <p>This code expires in 10 minutes.</p>
    </div>`,
  });
};

export const sendPasswordResetCode = async (email, code) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Password Reset — TravelApp",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#FF6B35">Reset your password</h2>
      <p>Your password reset code is:</p>
      <h1 style="letter-spacing:8px;color:#FF6B35">${code}</h1>
      <p>This code expires in 10 minutes.</p>
    </div>`,
  });
};

export const createNotification = async (userId, message, type, extra = {}) => {
  const notification = await Notification.create({
    userId,
    message,
    type,
    ...extra,
  });
  const { getIO } = await import("../app.js");
  const io = getIO();
  if (io) io.to(String(userId)).emit("newNotification", notification);
  return notification;
};
