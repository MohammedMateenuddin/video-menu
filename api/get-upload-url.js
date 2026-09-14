import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      return res.status(400).json({ error: 'Filename and contentType are required' });
    }

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const publicUrl = process.env.R2_PUBLIC_URL;

    if (!accountId || !accessKeyId || !secretAccessKey || !publicUrl) {
      return res.status(500).json({ error: 'R2 credentials missing on server' });
    }

    const s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const command = new PutObjectCommand({
      Bucket: 'videomenu-media',
      Key: filename,
      ContentType: contentType,
    });

    // Generate a URL that expires in 15 minutes
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

    // The public URL that this file will have once uploaded
    // Clean up trailing slash from process.env.R2_PUBLIC_URL just in case
    const baseUrl = publicUrl.replace(/\/$/, '');
    const finalUrl = `${baseUrl}/${filename}`;

    res.status(200).json({ signedUrl, finalUrl });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL', details: error.message });
  }
}
