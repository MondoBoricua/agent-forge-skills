import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// V2 accepts the definition directly; no SDK package is needed by this plugin.
export default {
  id: "skill-find",
  async setup(ctx) {
    const writeLog = (entry) => {
      try {
        const file = process.env.SKILL_FIND_PLUGIN_LOG ||
          path.join(os.homedir(), ".local/state/opencode/skill-find-plugin.log"); // estado global de OpenCode (opencode debug paths), no dentro de cada proyecto
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.appendFileSync(file, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
      } catch { /* Logging must never stop a session. */ }
    };
    // Retained only for this plugin instance; session IDs prevent cross-session suppression.
    const injected = new Map();
    try {
      await ctx.session.hook("context", (event) => {
        const start = Date.now();
        let sha = "error";
        const log = (reason, candidates = [], didInject = false, skipped = true) =>
          writeLog({ sessionID: event?.sessionID, prompt_sha256_12: sha.slice(0, 12),
            skipped, reason, candidates, injected: didInject, ms: Date.now() - start });
        try {
          const user = [...(event.messages || [])].reverse().find(m => m.role === "user");
          const text = (Array.isArray(user?.content) ? user.content : [])
            .filter(p => p?.type === "text" && typeof p.text === "string")
            .map(p => p.text).join("\n");
          sha = createHash("sha256").update(text).digest("hex");
          if (text.trim().length < 20) return log("too_short");
          if (text.trimStart().startsWith("<")) return log("starts_with_tag");
          if (text.includes("<task-notification>") || text.includes("[SYSTEM NOTIFICATION"))
            return log("system_notification");
          // Missing session identity cannot safely share deduplication state.
          if (typeof event.sessionID !== "string") return log("missing_session_id");
          if (injected.get(event.sessionID)?.has(sha)) return log("already_injected");
          const bin = process.env.SKILL_FIND_BIN || path.join(os.homedir(), ".local/bin/skill-find");
          const args = ["-I", bin, "--auto=" + text, "--json"];
          if (process.env.SKILL_FIND_INDEX) args.push("--index", process.env.SKILL_FIND_INDEX);
          let rows;
          try {
            rows = JSON.parse(execFileSync("python3", args, {
              encoding: "utf8", timeout: 4000, stdio: ["ignore", "pipe", "ignore"],
            }));
          } catch (err) {
            // skill-find exits with code 1 and stdout '[]\n' when no candidates are found
            if (err?.status === 1 && typeof err?.stdout === "string") {
              try {
                const parsed = JSON.parse(err.stdout);
                if (Array.isArray(parsed)) rows = parsed;
              } catch { /* proceed to exec_or_json_error */ }
            }
            if (!rows) return log("exec_or_json_error", [], false, false);
          }
          const candidates = (Array.isArray(rows) ? rows : [])
            .filter(r => r?.bucket === "library" && typeof r.name === "string")
            .slice(0, 3).map(r => r.name);
          if (!candidates.length) return log("no_library_candidates", [], false, false);
          const notice = ("skill-find: posibles skills de la biblioteca para esto: " +
            candidates.join(", ") +
            "; si aplica, lee ~/.agents/skills-library/<skill>/SKILL.md antes de empezar").slice(0, 400);
          if (!Array.isArray(event.system)) event.system = [];
          event.system.push({ type: "text", text: notice });
          if (!injected.has(event.sessionID)) injected.set(event.sessionID, new Set());
          injected.get(event.sessionID).add(sha);
          log(null, candidates, true, false);
        } catch { log("unexpected_error", [], false, false); }
      });
      writeLog({ loaded: true, hook: "context" });
    } catch { writeLog({ loaded: false, reason: "setup_error" }); }
  },
};
