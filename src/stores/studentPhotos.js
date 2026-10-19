import { createPhotoCache } from "../lib/photoCache";
import { getStudentPhotoPresignedUrl } from "../supabase";
import { userId } from "./auth";

const photos = createPhotoCache({ sign: getStudentPhotoPresignedUrl });
export function loadStudentPhoto(path) {
  return photos.load(path, userId.value);
}

export function peekStudentPhoto(path) {
  return photos.peek(path, userId.value);
}