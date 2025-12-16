export async function getFromR2(
  bucket: R2Bucket,
  key: string
): Promise<ArrayBuffer | null> {
  try {
    const object = await bucket.get(key);

    if (!object) {
      console.warn("Object not found in R2", { key });
      return null;
    }

    return await object.arrayBuffer();
  } catch (error) {
    console.error("Failed to get object from R2", { key, error });
    return null;
  }
}
