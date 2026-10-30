// Runs inside Steam's SharedJSContext: asks Decky to install /tmp/Lyrenne.zip and confirms the prompt.
new Promise((resolve) => {
  const B = window.DeckyBackend;
  const onPrompt = (name, version, requestId) => {
    B.removeEventListener("loader/add_plugin_install_prompt", onPrompt);
    B.call("utilities/confirm_plugin_install", requestId).then(() => resolve("installed " + name));
  };
  B.addEventListener("loader/add_plugin_install_prompt", onPrompt);
  B.call("utilities/install_plugin", "file:///tmp/Lyrenne.zip", "Lyrenne", "dev", "", 0);
  setTimeout(() => resolve("timed out"), 30000);
});
