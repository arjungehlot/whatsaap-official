const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory()
      ? files(full)
      : entry.isFile() && entry.name.endsWith('.js')
        ? [full]
        : [];
  });
}

const source = path.resolve(__dirname, '..');
for (const file of files(source)) {
  const result = spawnSync(process.execPath, ['--check', file], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
const openApi = require('../../docs/openapi');
const references = new Set();
function collectReferences(value) {
  if (Array.isArray(value)) return value.forEach(collectReferences);
  if (!value || typeof value !== 'object') return;
  if (typeof value.$ref === 'string') references.add(value.$ref);
  Object.values(value).forEach(collectReferences);
}
collectReferences(openApi);
for (const reference of references) {
  const match = reference.match(/^#\/components\/schemas\/(.+)$/);
  if (match && !openApi.components?.schemas?.[match[1]])
    throw new Error(`OpenAPI references missing schema: ${reference}`);
}
for (const route of [
  '/api/v1/whatsapp/sendMessage',
  '/api/v1/whatsapp/meta/media/upload',
  '/api/v1/contact/save',
  '/api/v1/user/agent',
  '/api/v1/whatsapp/chat/assignment',
  '/messages',
  '/messages/bulk',
]) {
  if (!openApi.paths?.[route]) throw new Error(`OpenAPI path is missing: ${route}`);
}
console.log('JavaScript syntax and OpenAPI contract checks passed.');
