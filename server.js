import dotenv from "dotenv";
dotenv.config();

import http from "http";
import { Server } from "socket.io";
import app, { initSocket } from "./src/app.js";
import connectDB from "./config/db.config.js";
import { startTripStatusCron } from "./src/crons/tripStatus.cron.js";

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE", "PATCH"] },
});
initSocket(io);

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  startTripStatusCron();
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
