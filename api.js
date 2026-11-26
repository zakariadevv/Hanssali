import { API_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";
export async function api(action, payload = {}, endpoint = "hansali-api") {
  const response = await fetch(`${API_URL}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_PUBLISHABLE_KEY },
    body: JSON.stringify({ action, ...payload })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
export function toast(message, target = "toast") {
  const el = document.getElementById(target);
  if (!el) return;
  el.textContent = message; el.classList.add("show");
  clearTimeout(el._timer); el._timer = setTimeout(() => el.classList.remove("show"), 2600);
}
export async function uploadMedia(file, context = {}) {
  if (!file) return null;
  if (file.size > 15 * 1024 * 1024) throw new Error("File exceeds the 15 MB limit.");
  const signed = await api("create_upload_url", {
    ...context, size: file.size, content_type: file.type || "application/octet-stream", file_name: file.name
  });
  const { supabase } = await import("./supabase.js");
  const { error } = await supabase.storage.from(MEDIA_BUCKET).uploadToSignedUrl(
    signed.path, signed.token, file, { contentType: file.type || "application/octet-stream" }
  );
  if (error) throw error;
  return { path: signed.path, url: null };
}
