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
export async function uploadMedia(file, folder) {
  if (!file) return null;
  if (file.size > 15 * 1024 * 1024) throw new Error("File exceeds the 15 MB limit.");
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${folder}/${crypto.randomUUID()}-${safe}`;
  const { supabase } = await import("./supabase.js");
  const { error } = await supabase.storage.from("hansali-media").upload(path, file, { upsert: false, contentType: file.type || "application/octet-stream" });
  if (error) throw error;
  const { data } = supabase.storage.from("hansali-media").getPublicUrl(path);
  return { path, url: data.publicUrl };
}
