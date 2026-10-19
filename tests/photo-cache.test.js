import { test } from "node:test";
import assert from "node:assert/strict";
import { createPhotoCache } from "../src/lib/photoCache.js";

function fixture() {
  const entries = new Map();
  let time = 1000, signs = 0, downloads = 0, blobs = 0;
  const options = {
    sign: async () => { signs++; return { presignedUrl: "https://photos.example/signed" }; },
    fetchImage: async () => { downloads++; return new Response(new Blob(["image"], { type: "image/jpeg" })); },
    storage: { open: async () => ({
      match: async (key) => entries.get(key)?.clone(),
      put: async (key, response) => entries.set(key, response.clone()),
      delete: async (key) => entries.delete(key),
    }) },
    now: () => time,
    objectUrl: () => "blob:photo-" + ++blobs,
    revokeUrl: () => {},
    origin: () => "https://app.example",
  };
  return {
    options, advance: (days) => { time += days * 86400000; },
    counts: () => ({ signs, downloads }),
  };
}

test("concurrent views share one signed request and one image download", async () => {
  const f = fixture(), cache = createPhotoCache(f.options);
  const urls = await Promise.all([cache.load("photo", "teacher"), cache.load("photo", "teacher")]);
  assert.equal(urls[0], urls[1]);
  assert.deepEqual(f.counts(), { signs: 1, downloads: 1 });
});

test("image survives app restart for a month without refreshing expired signed URLs", async () => {
  const f = fixture();
  await createPhotoCache(f.options).load("photo", "teacher");
  f.advance(30);
  assert.match(await createPhotoCache(f.options).load("photo", "teacher"), /^blob:/);
  assert.deepEqual(f.counts(), { signs: 1, downloads: 1 });
  f.advance(2);
  await createPhotoCache(f.options).load("photo", "teacher");
  assert.deepEqual(f.counts(), { signs: 2, downloads: 2 });
});

test("different accounts and replacement photo references use separate entries", async () => {
  const f = fixture(), cache = createPhotoCache(f.options);
  await cache.load("photo", "teacher-a");
  await cache.load("photo", "teacher-b");
  await cache.load("replacement", "teacher-a");
  assert.deepEqual(f.counts(), { signs: 3, downloads: 3 });
});

test("storage failure still retains a downloaded photo in memory", async () => {
  const f = fixture();
  f.options.storage = { open: async () => { throw new Error("Storage denied"); } };
  const cache = createPhotoCache(f.options);
  await cache.load("photo", "teacher");
  await cache.load("photo", "teacher");
  assert.deepEqual(f.counts(), { signs: 1, downloads: 1 });
});

test("failed signing is not permanently cached", async () => {
  const f = fixture();
  let fail = true;
  f.options.sign = async () => { if (fail) throw new Error("Offline"); return { presignedUrl: "https://photos.example/signed" }; };
  const cache = createPhotoCache(f.options);
  await assert.rejects(cache.load("photo", "teacher"));
  fail = false;
  assert.match(await cache.load("photo", "teacher"), /^blob:/);
});

test("already loaded images have a synchronous fast path when revisiting a student", async () => {
  const f = fixture(), cache = createPhotoCache(f.options);
  assert.equal(cache.peek("photo", "teacher"), null);
  const loaded = await cache.load("photo", "teacher");
  assert.equal(cache.peek("photo", "teacher"), loaded);
  assert.equal(cache.peek("photo", "different-teacher"), null);
  f.advance(32);
  assert.equal(cache.peek("photo", "teacher"), null);
});
