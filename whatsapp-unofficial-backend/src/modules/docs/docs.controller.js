import { buildOpenApiSpec } from "./openapi.service.js";

export function getOpenApiSpec(req, res) {
  res.json(buildOpenApiSpec(req));
}
