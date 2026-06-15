// Idempotent seed for the admin dashboard.
// Run with:  npm run seed
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import connectDB from "../config/db.config.js";
import { User } from "./models/user.model.js";
import { Subscription } from "./models/subscription.model.js";
import { Terms } from "./models/terms.model.js";
import { HelpTicket } from "./models/helpTicket.model.js";

const ADMIN = { name: "James Root", email: "admin@gmail.com", password: "123456" };

const PLANS = [
  { name: "Basic", description: "Buy the plan and get AI agent suggestion.", price: 4.99, currency: "£", interval: "Month", searchLimit: 100, features: ["AI agent suggestion", "100 searches / month"] },
  { name: "Premium", description: "Buy the plan and get unlimited AI agent suggestion.", price: 48.0, currency: "£", interval: "Unlimited", searchLimit: 1200, features: ["Unlimited AI agent suggestion", "1200 searches"] },
];

const TERMS_BODY = Array(4)
  .fill(
    "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book."
  )
  .join("\n\n");

const FIRST = ["Mr Raja", "Sr. Jogesh", "Rahul Tr", "Aisha Khan", "Leo Marin", "Nina Park", "Omar Said", "Tara Bose", "Ivan Petrov", "Maya Lin", "Carlos Ruiz", "Hana Sato"];
const SUBJECTS = ["Post Issues", "Payment Problem", "Login Trouble", "Account Question", "Bug Report"];

async function run() {
  await connectDB();

  // 1) Admin user
  let admin = await User.findOne({ email: ADMIN.email });
  if (!admin) {
    admin = new User({ ...ADMIN, accountType: "admin", isVerified: true });
    await admin.save(); // pre-save hook hashes the password
    console.log("✓ Created admin:", ADMIN.email, "/", ADMIN.password);
  } else {
    admin.accountType = "admin";
    admin.isVerified = true;
    admin.isBanned = false;
    admin.password = ADMIN.password; // re-hash via pre-save
    await admin.save();
    console.log("✓ Admin ensured:", ADMIN.email, "/", ADMIN.password);
  }

  // 2) Subscription plans
  for (const plan of PLANS) {
    const exists = await Subscription.findOne({ name: plan.name });
    if (!exists) {
      await Subscription.create(plan);
      console.log("✓ Created plan:", plan.name);
    }
  }

  // 3) Terms doc
  const terms = await Terms.findOne({ type: "terms" });
  if (!terms || !terms.content) {
    await Terms.findOneAndUpdate({ type: "terms" }, { content: TERMS_BODY }, { upsert: true, setDefaultsOnInsert: true });
    console.log("✓ Seeded terms & conditions");
  }

  // 4) Demo users (only if few exist) — idempotent by deterministic email
  const userCount = await User.countDocuments({ accountType: "user" });
  if (userCount < 6) {
    const now = Date.now();
    for (let i = 0; i < FIRST.length; i++) {
      const email = `demo${i + 1}@gmail.com`;
      if (await User.findOne({ email })) continue;
      const paid = i % 2 === 0;
      const u = new User({
        name: FIRST[i],
        email,
        password: "Demo@1234",
        accountType: "user",
        isVerified: true,
        subscriptionStatus: paid ? "paid" : "free",
        totalSpent: paid ? [560, 320, 199, 48, 96][i % 5] : 0,
        subscribedAt: paid ? new Date(now - i * 86400000) : null,
        postsCount: (i * 3) % 20,
        tripsCount: (i * 2) % 15,
      });
      // spread createdAt across the last ~30 days for nicer charts
      u.createdAt = new Date(now - (i * 2 + 1) * 86400000);
      await u.save({ timestamps: false });
    }
    console.log("✓ Seeded demo users");

    // a few help tickets
    const someUsers = await User.find({ accountType: "user" }).limit(5);
    const ticketCount = await HelpTicket.countDocuments();
    if (ticketCount === 0) {
      for (let i = 0; i < someUsers.length; i++) {
        await HelpTicket.create({
          userId: someUsers[i]._id,
          subject: SUBJECTS[i % SUBJECTS.length],
          description: "I can't post anything and i think there are some problem.",
          status: ["open", "in-progress", "resolved"][i % 3],
        });
      }
      console.log("✓ Seeded help tickets");
    }
  }

  console.log("\nSeed complete.");
  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
