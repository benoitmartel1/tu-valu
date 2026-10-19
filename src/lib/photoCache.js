const MONTH = 31 * 24 * 60 * 60 * 1000;

export function createPhotoCache({ sign, storage = globalThis.caches, fetchImage = globalThis.fetch, now = Date.now, objectUrl = (blob) => URL.createObjectURL(blob), revokeUrl = (url) => URL.revokeObjectURL(url), origin = () => globalThis.location.origin } = {}) {
  const memory = new Map();
  async function load(path, scope) {
    if (!path || !scope) return null;
    const id = JSON.stringify([scope, path]);
    const existing = memory.get(id);
    if (existing && existing.expires > now()) return existing.promise;
    if (existing) {
      memory.delete(id);
      existing.promise.then((url) => { if (url?.startsWith("blob:")) revokeUrl(url); });
    }
    const entry = { expires: now() + MONTH };
    entry.promise = (async () => {
      let cache, key;
      try {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id));
        const hash = [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, "0")).join("");
        key = new URL("/__tu-valu-photo-cache__/" + hash, origin()).href;
        cache = await storage?.open("tu-valu-student-photos-v1");
        const cached = await cache?.match(key);
        if (cached && Number(cached.headers.get("x-photo-expires")) > now()) {
          entry.expires = Number(cached.headers.get("x-photo-expires"));
          return objectUrl(await cached.blob());
        }
        if (cached) await cache.delete(key);
      } catch {
        // Continue with the in-memory cache if persistent storage is unavailable.
      }
      const { presignedUrl } = await sign(path);
      if (!presignedUrl) throw new Error("No signed photo URL returned");
      try {
        const response = await fetchImage(presignedUrl);
        if (!response.ok) throw new Error("Photo download failed");
        const blob = await response.blob();
        if (!blob.size || !blob.type.startsWith("image/")) throw new Error("Invalid photo response");
        entry.expires = now() + MONTH;
        if (cache && key) {
          try {
            await cache.put(key, new Response(blob, { headers: {
              "content-type": blob.type,
              "x-photo-expires": String(entry.expires),
            } }));
          } catch {
            // A full or restricted cache must not prevent displaying the image.
          }
        }
        return objectUrl(blob);
      } catch {
        // Images may be displayable even when cross-origin fetch is restricted.
        // Retain the signed URL only briefly; never treat it as a month-long cache.
        entry.expires = now() + 60000;
        return presignedUrl;
      }
    })().then((url) => { entry.url = url; return url; }).catch((error) => { if (memory.get(id) === entry) memory.delete(id); throw error; });
    memory.set(id, entry);
    return entry.promise;
  }
  function peek(path, scope) {
    const entry = memory.get(JSON.stringify([scope, path]));
    return entry && entry.expires > now() ? entry.url || null : null;
  }
  return { load, peek };
}
