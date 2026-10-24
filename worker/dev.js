import production from "./index.js";
import { jsonResponse } from "./state.js";

export { DespensaState } from "./index.js";

export default {
  fetch(request, env) {
    if (!["localhost", "127.0.0.1"].includes(new URL(request.url).hostname)) {
      return jsonResponse({ error: "El servidor de desarrollo solo admite localhost." }, 403);
    }
    return production.fetch(request, { ...env, APP_PASSWORD: "despensa-prueba-local-2026" });
  },
};
