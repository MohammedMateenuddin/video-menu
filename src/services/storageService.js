import { supabase } from "../lib/supabase";

export async function uploadMenuMedia(file, restaurantId, type) {
  if (!file) {
    throw new Error("No file selected.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "file";

  const fileName = `${crypto.randomUUID()}.${extension}`;

  const filePath = `${restaurantId}/${type}/${fileName}`;

  const { error } = await supabase.storage
    .from("menu-media")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("menu-media").getPublicUrl(filePath);

  return publicUrl;
}

export async function deleteMenuMedia(url) {
  if (!url) return;
  try {
    const bucketAndPath = url.split("/storage/v1/object/public/")[1];
    if (!bucketAndPath) return;

    const parts = bucketAndPath.split("/");
    const bucket = parts.shift();
    const filePath = parts.join("/");

    await supabase.storage.from(bucket).remove([filePath]);
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}
