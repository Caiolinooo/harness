import Link from "next/link";
import { getStore } from "@/lib/store";
import { ApproveButton } from "@/components/ApproveButton";

export const dynamic = "force-dynamic";

export default function ApprovalsPage() {
  const pending = getStore().listPendingApprovals();
  return (
    <>
      <h1>HITL Inbox</h1>
      <p className="sub">PRD, sprint, purchase, playtest, and setup gates.</p>
      <div className="grid">
        {pending.length === 0 ? (
          <div className="panel">Inbox empty.</div>
        ) : (
          pending.map((a) => (
            <div className="panel" key={a.id}>
              <div className="pill warn">{a.kind}</div>
              <h2>{a.title}</h2>
              <p className="sub">{a.description}</p>
              <p className="mono">
                run <Link href={`/runs/${a.runId}`}>{a.runId.slice(0, 8)}</Link>{" "}
                · {a.id}
              </p>
              <ApproveButton approvalId={a.id} />
            </div>
          ))
        )}
      </div>
    </>
  );
}
