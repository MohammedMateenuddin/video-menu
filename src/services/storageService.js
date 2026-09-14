import { supabase } from "../lib/supabase";

export async function uploadMenuMedia(file, restaurantId, type) {
  if (!file) {
    throw new Error("No file selected.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "file";
  const fileName = `${restaurantId}/${type}/${crypto.randomUUID()}.${extension}`;

  // 1. Get Presigned URL from our Vercel API
  const res = await fetch('/api/get-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: fileName,
      contentType: file.type || 'application/octet-stream',
    }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || 'Failed to get upload URL');
  }

  const { signedUrl, finalUrl } = await res.json();

  // 2. Upload directly to Cloudflare R2 using the presigned URL
  const uploadRes = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
  });

  if (!uploadRes.ok) {
    throw new Error('Failed to upload file to Cloudflare R2');
  }

  // 3. Return the public URL
  return finalUrl;
}

export async function deleteMenuMedia(url) {
  if (!url) return;
  try {
    // Check if it's an old Supabase URL
    if (url.includes("/storage/v1/object/public/")) {
      const bucketAndPath = url.split("/storage/v1/object/public/")[1];
      if (!bucketAndPath) return;

      const parts = bucketAndPath.split("/");
      const bucket = parts.shift();
      const filePath = parts.join("/");

      await supabase.storage.from(bucket).remove([filePath]);
      return;
    }

    // Otherwise, assume it's an R2 URL
    // Extract the S3 key from the URL path (e.g., https://pub-xxx.r2.dev/restaurant/logo/file.png -> restaurant/logo/file.png)
    let key;
    try {
      const urlObj = new URL(url);
      key = urlObj.pathname.substring(1); // removes leading slash
    } catch (e) {
      return; // invalid URL
    }

    if (!key) return;

    await fetch('/api/delete-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: key }),
    });

  } catch (error) {
    console.error("Cleanup error:", error);
  }
}
