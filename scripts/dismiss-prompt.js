// Runs in the Big Picture window: Decky still shows its install prompt after install.js has
// confirmed through the backend, so close it.
(() => {
  const title = [...document.querySelectorAll("*")].find((e) => e.childElementCount === 0 && /^Install Lyrenne$/.test(e.textContent.trim()));
  if (!title) return "no prompt";
  let dlg = title;
  while (dlg && !dlg.querySelector?.("button, .DialogButton")) dlg = dlg.parentElement;
  const cancel = dlg && [...dlg.querySelectorAll("*")].find((e) => e.childElementCount === 0 && e.textContent.trim() === "Cancel");
  cancel?.click();
  return cancel ? "dismissed" : "no cancel button";
})();
