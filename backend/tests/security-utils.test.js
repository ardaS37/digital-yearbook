const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  assertImageSignature,
  getSafeImageExtension,
  isAllowedImageMime
} = require('../src/utils/uploadValidation');
const { safeRedirectPath } = require('../src/utils/redirects');

test('image uploads use server-controlled extensions and exact MIME signatures', (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yearbook-image-test-'));
  t.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

  assert.equal(getSafeImageExtension('image/jpeg'), '.jpg');
  assert.equal(getSafeImageExtension('text/html'), null);
  assert.equal(isAllowedImageMime('image/svg+xml'), false);

  const pngPath = path.join(tempDir, 'payload.html');
  fs.writeFileSync(pngPath, Buffer.from('89504e470d0a1a0a00000000', 'hex'));
  assert.doesNotThrow(() => assertImageSignature({ path: pngPath, mimetype: 'image/png' }));
  assert.throws(
    () => assertImageSignature({ path: pngPath, mimetype: 'image/jpeg' }),
    /bildirilen görsel türüyle eşleşmiyor/
  );

  const fakeWebpPath = path.join(tempDir, 'fake.webp');
  fs.writeFileSync(fakeWebpPath, Buffer.from('52494646000000004e4f5045', 'hex'));
  assert.throws(() => assertImageSignature({ path: fakeWebpPath, mimetype: 'image/webp' }));
});

test('cookie consent redirects stay on yearbook.example', () => {
  assert.equal(safeRedirectPath('/gallery?class=12-A'), '/gallery?class=12-A');
  assert.equal(safeRedirectPath('https://yearbook.example/profiles/1', '/', ['yearbook.example']), '/profiles/1');
  assert.equal(safeRedirectPath('//evil.example/phish', '/', ['yearbook.example']), '/');
  assert.equal(safeRedirectPath('https://evil.example/phish', '/', ['yearbook.example']), '/');
  assert.equal(safeRedirectPath('/\\evil.example', '/', ['yearbook.example']), '/');
});
