import { createRequire } from "node:module";

// Express 4 only catches synchronous route errors. Forward rejected async handlers to next().
const require = createRequire(import.meta.url);
const Layer = require("express/lib/router/layer");
const originalHandleRequest = Layer.prototype.handle_request;

Layer.prototype.handle_request = function handleAsyncRequest(req, res, next) {
  const handler = this.handle;
  if (handler.length > 3) return originalHandleRequest.call(this, req, res, next);

  try {
    const result = handler(req, res, next);
    if (result && typeof result.catch === "function") result.catch(next);
  } catch (error) {
    next(error);
  }
};
