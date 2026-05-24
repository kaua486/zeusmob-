import { Router, type IRouter } from "express";
import healthRouter from "./health";
import apkRouter from "./apk";

const router: IRouter = Router();

router.use(healthRouter);
router.use(apkRouter);

export default router;
