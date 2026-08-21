import { notFound } from "next/navigation";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getStore } from "@/lib/store";
import { dataDir } from "@/lib/paths";
import { ApproveButton } from "@/components/ApproveButton";

export const dynamic = "force-dynamic";

export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = getStore();
  const run = store.getRun(id);
  if (!run) notFound();

  const artifacts = store.listArtifacts(id);
  const approvals = store.listPendingApprovals(id);
  const artDir = join(dataDir(), "runs", id, "artifacts");
  const files = existsSync(artDir) ? listFiles(artDir) : [];
  const spanFile = join(dataDir(), "runs", id, "spans", "spans.jsonl");
  const spanCount = existsSync(spanFile)
    ? readFileSync(spanFile, "utf8").trim().split("\n").filter(Boolean).length
    : 0;

  return (
    <>
      <h1>Run {run.id.slice(0, 8)}</h1>
      <p className="sub">
        {run.pipeline} · {run.vertical} · {run.workspace}
      </p>

      <div className="stat-row">
        <div className="stat">
          <label>Status</label>
          <strong>{run.status}</strong>
        </div>
        <div className="stat">
          <label>Phase</label>
          <strong className="mono" style={{ fontSize: "1rem" }}>
            {run.phase}
          </strong>
        </div>
        <div className="stat">
          <label>Tokens</label>
          <strong>{run.tokensUsed.toLocaleString()}</strong>
        </div>
        <div className="stat">
          <label>Spans</label>
          <strong>{spanCount}</strong>
        </div>
      </div>

      <div className="grid">
        <section className="panel">
          <h2>Brief</h2>
          <p className="mono">{run.brief}</p>
          {run.error ? (
            <p className="mono" style={{ color: "var(--danger)" }}>
              {run.error}
            </p>
          ) : null}
        </section>

        <section className="panel">
          <h2>HITL</h2>
          {approvals.length === 0 ? (
            <p className="sub">No pending approvals</p>
          ) : (
            approvals.map((a) => (
              <div key={a.id} style={{ marginBottom: "0.75rem" }}>
                <div>
                  <strong>{a.title}</strong>
                  <div className="sub">{a.description}</div>
                  <div className="mono">{a.id}</div>
                </div>
                <ApproveButton approvalId={a.id} />
              </div>
            ))
          )}
        </section>

        <section className="panel">
          <h2>Artifacts</h2>
          <ul>
            {artifacts.map((a) => (
              <li key={a.path} className="mono">
                {a.kind}: {a.path}
              </li>
            ))}
          </ul>
          <h3>Workspace artifact files</h3>
          <ul>
            {files.map((f) => (
              <li key={f} className="mono">
                {f}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

function listFiles(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${name.name}` : name.name;
    if (name.isDirectory()) out.push(...listFiles(join(dir, name.name), rel));
    else out.push(rel);
  }
  return out;
}
