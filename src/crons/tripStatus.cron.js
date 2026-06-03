import cron from "node-cron";
import { Trip } from "../models/trip.model.js";
import { createNotification } from "../utility/helper.js";

export const startTripStatusCron = () => {
  // Runs every minute
  cron.schedule("*/1 * * * *", async () => {
    try {
      const now = new Date();

      // upcoming → ongoing: trips whose fromDate has arrived
      const toOngoing = await Trip.find({
        status: "upcoming",
        fromDate: { $lte: now },
        toDate: { $gte: now },
      });

      for (const trip of toOngoing) {
        trip.status = "ongoing";
        await trip.save();
        await createNotification(
          trip.userId,
          `Your trip "${trip.tripName}" has started! Have a great journey.`,
          "trip-ongoing",
          { relatedId: trip._id, relatedType: "trip" }
        );
      }

      // ongoing → completed: trips whose toDate has passed
      const toCompleted = await Trip.find({
        status: "ongoing",
        toDate: { $lt: now },
      });

      for (const trip of toCompleted) {
        trip.status = "completed";
        await trip.save();
        await createNotification(
          trip.userId,
          `Your trip "${trip.tripName}" is complete! Share your experience with a review.`,
          "trip-completed",
          { relatedId: trip._id, relatedType: "trip" }
        );
      }

      // Also catch upcoming trips that were somehow skipped (fromDate AND toDate both passed)
      const missedCompleted = await Trip.find({
        status: "upcoming",
        toDate: { $lt: now },
      });

      for (const trip of missedCompleted) {
        trip.status = "completed";
        await trip.save();
        await createNotification(
          trip.userId,
          `Your trip "${trip.tripName}" is complete! Share your experience with a review.`,
          "trip-completed",
          { relatedId: trip._id, relatedType: "trip" }
        );
      }
    } catch (err) {
      console.error("Trip status cron error:", err.message);
    }
  });

  console.log("Trip status cron started");
};
