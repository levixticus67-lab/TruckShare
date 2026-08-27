import { Router, type IRouter } from "express";
import healthRouter from "./health";
import returnhaulRouter from "./returnhaul";

const router: IRouter = Router();

router.use(healthRouter);
router.use(returnhaulRouter);

export default router;
