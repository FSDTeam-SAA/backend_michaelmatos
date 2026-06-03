import catchAsync from "../utility/catchAsync.js";
import { sendResponse } from "../utility/helper.js";
import { Notification } from "../models/notification.model.js";

export const getNotifications = catchAsync(async (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const notifications = await Notification.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Notification.countDocuments({ userId: req.user._id });
  const unreadCount = await Notification.countDocuments({ userId: req.user._id, isRead: false });

  sendResponse(res, { statusCode: 200, success: true, message: "Notifications retrieved", data: { notifications, total, unreadCount, page: Number(page) } });
});

export const markAllRead = catchAsync(async (req, res, next) => {
  await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
  sendResponse(res, { statusCode: 200, success: true, message: "All notifications marked as read", data: null });
});

export const markOneRead = catchAsync(async (req, res, next) => {
  await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { isRead: true }
  );
  sendResponse(res, { statusCode: 200, success: true, message: "Notification marked as read", data: null });
});

export const deleteNotification = catchAsync(async (req, res, next) => {
  await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  sendResponse(res, { statusCode: 200, success: true, message: "Notification deleted", data: null });
});
