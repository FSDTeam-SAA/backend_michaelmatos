import mongoose from "mongoose";

const connectDB = async () => {
  await mongoose.connect(process.env.MongoDB_URI);
  console.log("MongoDB connected");
};

export default connectDB;
