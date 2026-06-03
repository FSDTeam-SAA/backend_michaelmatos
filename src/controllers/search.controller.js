import catchAsync from "../utility/catchAsync.js";
import { sendResponse } from "../utility/helper.js";
import { Place } from "../models/place.model.js";
import { User } from "../models/user.model.js";
import { Post } from "../models/post.model.js";

export const search = catchAsync(async (req, res, next) => {
  const { q, type = "all", page = 1, limit = 10 } = req.query;
  if (!q) return sendResponse(res, { statusCode: 200, success: true, message: "Results", data: { places: [], users: [], posts: [] } });

  const skip = (page - 1) * limit;
  const regex = { $regex: q, $options: "i" };

  const results = {};

  if (type === "all" || type === "places") {
    results.places = await Place.find({ $or: [{ name: regex }, { country: regex }] })
      .sort({ tripCount: -1 })
      .skip(skip)
      .limit(Number(limit));
  }

  if (type === "all" || type === "users") {
    results.users = await User.find({ name: regex })
      .select("name avatar location followersCount")
      .skip(skip)
      .limit(Number(limit));
  }

  if (type === "all" || type === "posts") {
    results.posts = await Post.find({ caption: regex, isPrivate: false })
      .populate("userId", "name avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));
  }

  sendResponse(res, { statusCode: 200, success: true, message: "Search results", data: results });
});

export const searchSuggestions = catchAsync(async (req, res, next) => {
  const { q } = req.query;
  if (!q || q.length < 2) return sendResponse(res, { statusCode: 200, success: true, message: "Suggestions", data: [] });

  const regex = { $regex: q, $options: "i" };
  const places = await Place.find({ name: regex }).select("name country placeType").limit(5);
  const suggestions = places.map((p) => ({ _id: p._id, name: p.name, subtitle: p.country, type: "place" }));

  sendResponse(res, { statusCode: 200, success: true, message: "Suggestions", data: suggestions });
});
