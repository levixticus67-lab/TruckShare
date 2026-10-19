import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const nativeFrontendOrigins = new Set(["https://localhost", "capacitor://localhost"]);
app.use(
  cors({
    origin: (origin, callback) => {
      const frontendOrigin = process.env.FRONTEND_URL?.replace(/\/$/, "");
      if (!origin || !frontendOrigin || origin === frontendOrigin || nativeFrontendOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("This origin is not allowed by CORS."));
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
