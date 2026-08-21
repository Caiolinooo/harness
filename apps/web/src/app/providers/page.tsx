import { readFileSync } from "node:fs";
import { ProvidersFileSchema } from "@harness/contracts";
import YAML from "yaml";
import { providersPath } from "@/lib/paths";

export const dynamic = "force-dynamic";

function loadProviders() {
  try {
    const raw = readFileSync(providersPath(), "utf8");
    const parsed = YAML.parse(raw);
    const doc = ProvidersFileSchema.parse(parsed);
    if (!doc?.roles) {
      return { error: "providers.yaml is missing a roles section" as const };
    }
    return { roles: doc.roles };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Invalid or missing providers.yaml";
    return { error: message };
  }
}

export default function ProvidersPage() {
  const result = loadProviders();

  return (
    <>
      <h1>Provider / role matrix</h1>
      <p className="sub">
        Edit <code className="mono">providers.yaml</code> to swap Kimi, Fable, GPT,
        Claude, GLM, MiniMax without changing pipeline code.
      </p>
      {"error" in result ? (
        <div className="panel" style={{ borderColor: "var(--danger)" }}>
          <h2>Could not load providers</h2>
          <p className="sub" style={{ color: "var(--danger)" }}>
            {result.error}
          </p>
        </div>
      ) : (
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Provider</th>
                <th>Model</th>
                <th>Reasoning</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(result.roles).map(([role, cfg]) => (
                <tr key={role}>
                  <td className="mono">{role}</td>
                  <td>{cfg.provider}</td>
                  <td className="mono">{cfg.model}</td>
                  <td>{cfg.reasoning ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
