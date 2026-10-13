/* Removes source-platform secrets from the runtime file after migration. */
const fs = require('fs');
const path = require('path');
const file = path.resolve(__dirname, '../../../.env.local');
const blocked = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]);
const original = fs.readFileSync(file, 'utf8');
const kept = original
  .split(/\r?\n/)
  .filter(
    (line) => !blocked.has((line.match(/^\s*([^#=]+)=/) || [])[1]?.trim())
  );
const active = new Set(
  kept
    .map((line) => (line.match(/^\s*([^#=]+)=/) || [])[1]?.trim())
    .filter(Boolean)
);
if (!active.has('NEXT_PUBLIC_API_URL'))
  kept.push('NEXT_PUBLIC_API_URL=http://localhost:4000/api');
if (!active.has('NEXT_PUBLIC_S3_PUBLIC_BASE_URL'))
  kept.push(
    'NEXT_PUBLIC_S3_PUBLIC_BASE_URL=https://s3.ap-south-1.amazonaws.com/smartitbox.bucket'
  );
const note =
  '# Supabase runtime settings removed: this application uses Node.js + MongoDB.\n';
fs.writeFileSync(
  file,
  `${note}${kept.join('\n').replace(/^\n+/, '')}`.replace(/\n*$/, '\n')
);
console.log('Removed Supabase runtime variables from .env.local.');
