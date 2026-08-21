import Link from "next/link";
import { getStore } from "@/lib/store";
import { NewRunForm } from "@/components/NewRunForm";
import {
  loadSettings,
  resolveEffectiveMode,
} from "@harness/providers";
import { dataDir } from "@/lib/paths";

export const dynamic = "force-dynamic";

function statusClass(status: string): string {
  if (status === "completed") return "ok";
  if (status === "failed" || status === "cancelled") return "danger";
  if (status === "awaiting_approval") return "warn";
  return "";
}

export default function HomePage() {
  const store = getStore();
  const runs = store.listRuns(30);
  const pending = store.listPendingApprovals();
  const totalCost = runs.reduce((a, r) => a + r.costUsd, 0);
  const totalTokens = runs.reduce((a, r) => a + r.tokensUsed, 0);
  const mode = resolveEffectiveMode(loadSettings(dataDir()));

  return (
    <>
      <h1>Control plane</h1>
      <p className="sub">
        Supervisor-Worker pipeline — modo <span className="pill">{mode}</span>.
        Configure keys em <Link href="/settings">Configurações</Link> quando quiser live.
      </p>

      <NewRunForm />

      <div className="stat-row">
        <div className="stat">
          <label>Runs</label>
          <strong>{runs.length}</strong>
        </div>
        <div className="stat">
          <label>Pending HITL</label>
          <strong>{pending.length}</strong>
        </div>
        <div className="stat">
          <label>Tokens</label>
          <strong>{totalTokens.toLocaleString()}</strong>
        </div>
        <div className="stat">
          <label>Spend</label>
          <strong>${totalCost.toFixed(3)}</strong>
        </div>
      </div>

      <div className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Run</th>
              <th>Status</th>
              <th>Phase</th>
              <th>Vertical</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  No runs yet. Use{" "}
                  <code className="mono">pnpm harness -- run -w ./examples/demo-app</code>
                </td>
              </tr>
            ) : (
              runs.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/runs/${r.id}`}>{r.id.slice(0, 8)}</Link>
                  </td>
                  <td>
                    <span className={`pill ${statusClass(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="mono">{r.phase}</td>
                  <td>{r.vertical}</td>
                  <td>${r.costUsd.toFixed(4)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
