"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApproveButton({ approvalId }: { approvalId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    try {
      await fetch(`/api/approvals/${approvalId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <button className="btn" disabled={busy} onClick={() => act("approve")}>
        Approve
      </button>
      <button
        className="btn secondary"
        disabled={busy}
        onClick={() => act("reject")}
      >
        Reject
      </button>
    </div>
  );
}
