"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function NewRunForm() {
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [vertical, setVertical] = useState("coding");
  const [workspace, setWorkspace] = useState("./examples/demo-app");
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/settings")
      .then(async (res) => {
        if (!res.ok) {
          setError("Could not load settings defaults");
          return;
        }
        const data = (await res.json()) as {
          effectiveMode?: "demo" | "live";
          settings?: {
            defaults?: { brief?: string; vertical?: string; workspace?: string };
          };
        };
        if (data.effectiveMode) setMode(data.effectiveMode);
        setBrief(data?.settings?.defaults?.brief ?? "");
        setVertical(data?.settings?.defaults?.vertical ?? "coding");
        setWorkspace(data?.settings?.defaults?.workspace ?? "./examples/demo-app");
      })
      .catch(() => {
        setError("Could not load settings defaults");
      });
  }, []);

  async function start() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief, vertical, workspace }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao iniciar run");
      router.push(`/runs/${data.run.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" style={{ marginBottom: "1.25rem" }}>
      <h2>Novo run</h2>
      <p className="sub">
        Modo efetivo: <span className="pill">{mode}</span>
        {mode === "demo"
          ? " — sem API keys, pipeline completo offline"
          : " — providers reais"}
      </p>
      <label className="field">
        <span>Brief</span>
        <textarea rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <label className="field">
          <span>Vertical</span>
          <select value={vertical} onChange={(e) => setVertical(e.target.value)}>
            <option value="coding">coding</option>
            <option value="unreal-cpp">unreal-cpp</option>
          </select>
        </label>
        <label className="field">
          <span>Workspace</span>
          <input value={workspace} onChange={(e) => setWorkspace(e.target.value)} />
        </label>
      </div>
      <button className="btn" disabled={busy} onClick={() => void start()}>
        {busy ? "Rodando pipeline…" : "Iniciar pipeline"}
      </button>
      {error ? (
        <p className="sub" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
