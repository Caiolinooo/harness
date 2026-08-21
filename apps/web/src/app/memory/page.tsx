import { createMemoryBackend } from "@harness/memory";
import { loadSettings } from "@harness/providers";
import { dataDir } from "@/lib/paths";
import { MemorySearch } from "@/components/MemorySearch";

export const dynamic = "force-dynamic";

export default async function MemoryPage() {
  const settings = loadSettings(dataDir());
  const memory = createMemoryBackend(dataDir(), settings.memory);
  const notes = memory ? await memory.listRecent(30) : [];

  return (
    <>
      <h1>Memory vault</h1>
      <p className="sub">
        Obsidian-compatible markdown memory — semantic, episodic, procedural.
        {memory ? (
          <>
            {" "}
            Root: <code className="mono">{memory.root}</code>
          </>
        ) : (
          " (disabled in settings)"
        )}
      </p>

      {!memory ? (
        <div className="panel">
          Ative <code className="mono">memory.kind = obsidian</code> em{" "}
          <a href="/settings">Configurações</a>.
        </div>
      ) : (
        <>
          <MemorySearch initialNotes={notes} />
          <section className="panel" style={{ marginTop: "1rem" }}>
            <h2>Layout</h2>
            <pre className="mono">{`Semantic/
  decisions.md
  learnings.md
  entities/
Episodes/
  YYYY-MM-DD.md
  runs/
Procedures/
  memory-policy.md
index.md`}</pre>
            <p className="sub">
              Abra a pasta no Obsidian (File → Open vault) para ver o Graph View.
            </p>
          </section>
        </>
      )}
    </>
  );
}
