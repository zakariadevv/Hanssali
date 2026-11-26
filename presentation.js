export function presentationUrl(url) {
  const encoded = encodeURIComponent(url);
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encoded}`;
}
export function showPresentation(container, url) {
  const src = presentationUrl(url);
  if (container.dataset.presentationUrl === src) return;
  container.dataset.presentationUrl = src;
  container.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.title = "PowerPoint presentation";
  iframe.allow = "fullscreen";
  iframe.loading = "lazy";
  container.append(iframe);
}
