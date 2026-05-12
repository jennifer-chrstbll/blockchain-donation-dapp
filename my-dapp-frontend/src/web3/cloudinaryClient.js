const CLOUD_NAME = "dbpxsdpvg";
const UPLOAD_PRESET = "ml_default"; // pastikan sudah di-set Unsigned di dashboard!

export async function uploadImageToCloudinary(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, // ← pakai CLOUD_NAME
    { method: "POST", body: formData }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.secure_url;
}