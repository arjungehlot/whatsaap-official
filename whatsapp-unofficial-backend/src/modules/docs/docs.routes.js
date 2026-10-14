import { Router } from "express";
import { getOpenApiSpec } from "./docs.controller.js";

export const docsRouter = Router();

docsRouter.get("/openapi.json", getOpenApiSpec);
