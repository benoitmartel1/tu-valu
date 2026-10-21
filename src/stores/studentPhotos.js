import { createPhotoCache } from "../lib/photoCache";
import { getStudentPhotoPresignedUrl } from "../supabase";
import { userId } from "./auth";

const photos = createPhotoCache({
  sign: getStudentPhotoPresignedUrl,
  fetchImage: (url) => {
    const photoUrl = new URL(url);
    if (import.meta.env.DEV &&
        photoUrl.origin === "https://s3.bhs.io.cloud.ovh.net" &&
        photoUrl.pathname.startsWith("/young-blackett/")) {
      return fetch("/__student-photos" + photoUrl.pathname + photoUrl.search);
    }
    return fetch(url);
  },
});
export function loadStudentPhoto(path) {
  return photos.load(path, userId.value);
}

export function peekStudentPhoto(path) {
  return photos.peek(path, userId.value);
}