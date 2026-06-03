import express from "express";
import cors from "cors";
import routes from "../config/route.config.js";
import { globalErrorHandler } from "./middlewares/globalError.middlewares.js";
import { notFound } from "./middlewares/notFound.middlewares.js";

const app = express();
let _io;

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1", routes);

app.use(notFound);
app.use(globalErrorHandler);

export const initSocket = (io) => {
  _io = io;
  io.on("connection", (socket) => {
    socket.on("join", (userId) => socket.join(userId));
    socket.on("disconnect", () => {});
  });
};

export const getIO = () => _io;

export default app;
