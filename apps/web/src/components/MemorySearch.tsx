"use client";

import { useState } from "react";

type Note = {
  path: string;
  kind: string;
  title: string;
  excerpt: string;
  tags: string[];
};

export function MemorySearch({ initialNotes }: { initialNotes: Note[] }) {
  const [q, setQ] = useState("");
  const [notes, setNotes] = useState(initialNotes);
  const [busy, setBusy] = useState(false);

  async function search() {
    setBusy(true);
    try {
      const url = q.trim()
        ? `/api/memory?q=${encodeURIComponent(q.trim())}`
        : "/api/memory";
      const res = await fetch(url);
      const data = await res.json();
      setNotes(data.notes ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          style={{ flex: 1 }}
          placeholder="Buscar decisions, learnings, episodes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void search();
          }}
        />
        <button className="btn" disabled={busy} onClick={() => void search()}>
          Buscar
        </button>
      </div>
      {notes.length === 0 ? (
        <p className="sub">Nenhuma nota ainda — rode um pipeline para popular o vault.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Kind</th>
              <th>Title</th>
              <th>Path</th>
              <th>Excerpt</th>
            </tr>
          </thead>
          <tbody>
            {notes.map((n) => (
              <tr key={n.path}>
                <td>
                  <span className="pill">{n.kind}</span>
                </td>
                <td>{n.title}</td>
                <td className="mono">{n.path}</td>
                <td className="mono">{n.excerpt.slice(0, 120)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
