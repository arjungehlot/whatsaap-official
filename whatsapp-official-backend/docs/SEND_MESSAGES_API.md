# Send Messages API

This folder contains the live Swagger/OpenAPI contract for WACRM's API-key messaging service:

- [send-messages.openapi.json](./send-messages.openapi.json)

## What is documented

- One text, image, video, audio, or document message to one WhatsApp number.
- Public HTTPS `file_url` media, optional captions, and a document filename.
- Sending a Meta-approved template with variable components.
- A durable, idempotent bulk-send job for up to 100 recipients and its status endpoint.
- API-key authentication using `Authorization: Bearer wacrm_...` or `X-API-Key: wacrm_...` and the `messages:send` scope.

## Test with Swagger UI

Start the Node backend, then open [http://localhost:4000/api/docs](http://localhost:4000/api/docs). Use **Authorize** to enter the raw `wacrm_...` API key with the `messages:send` scope; Swagger adds `Bearer` automatically. Expand an operation, select **Try it out**, provide a payload, and select **Execute**. This makes a real request, so only use a contact and WhatsApp configuration you are authorized to test.

The API definition is also available as JSON at [http://localhost:4000/api/v1/openapi.json](http://localhost:4000/api/v1/openapi.json). On deployment, replace `http://localhost:4000` with the public Node backend domain.

## API key workflow

The current app already lets an owner or admin create a key under **Settings → API keys**. Create a key with the `messages:send` scope, copy the plaintext key once, and keep it server-side in the caller's environment. Never expose it in browser JavaScript, a mobile app binary, a Git repository, or a screenshot.

## WhatsApp delivery rule

A `201`/accepted response only means Meta accepted the request. It is not proof that the contact received the message. Delivery/read/failure updates are recorded in **Message Logs** only after Meta can reach the configured public HTTPS webhook. Text and media messages are also subject to WhatsApp's customer-service window; approved templates are required outside it.
