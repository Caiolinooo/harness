"use client";

import { useEffect, useState } from "react";

type SettingsView = {
  mode: "demo" | "live";
  sandbox: "local" | "docker" | "firecracker";
  defaults: {
    vertical: string;
    workspace: string;
    autoApprove: boolean;
    brief: string;
  };
  memory: {
    kind: "none" | "obsidian";
    vaultPath: string;
    projectId: string;
    hydrateLimit: number;
  };
  secrets: Record<string, { set: boolean; masked: string }>;
  liveReady: boolean;
};

const SECRET_LABELS: Record<string, string> = {
  OPENROUTER_API_KEY: "OpenRouter (recomendado — multi-modelo)",
  OPENAI_API_KEY: "OpenAI",
  ANTHROPIC_API_KEY: "Anthropic",
  MOONSHOT_API_KEY: "Moonshot / Kimi",
};

const DEFAULT_MEMORY: SettingsView["memory"] = {
  kind: "obsidian",
  vaultPath: "",
  projectId: "default",
  hydrateLimit: 20,
};

export function SettingsForm() {
  const [view, setView] = useState<SettingsView | null>(null);
  const [effectiveMode, setEffectiveMode] = useState<"demo" | "live">("demo");
  const [draftSecrets, setDraftSecrets] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/settings");
    const data = await res.json();
    setView({
      ...data.settings,
      memory: data.settings?.memory ?? DEFAULT_MEMORY,
    });
    setEffectiveMode(data.effectiveMode);
    setDraftSecrets({});
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!view) return;
    setBusy(true);
    setStatus("");
    try {
      const secrets: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(draftSecrets)) {
        if (v === "") continue;
        if (v === "__CLEAR__") secrets[k] = null;
        else secrets[k] = v;
      }
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: view.mode,
          sandbox: view.sandbox,
          defaults: view.defaults,
          memory: view.memory,
          secrets,
        }),
      });
      const data = await res.json();
      setView({
        ...data.settings,
        memory: data.settings?.memory ?? DEFAULT_MEMORY,
      });
      setEffectiveMode(data.effectiveMode);
      setDraftSecrets({});
      setStatus("Configurações salvas em .harness/settings.json");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  }

  if (!view) {
    return <div className="panel">Carregando configurações…</div>;
  }

  const memory = view.memory ?? DEFAULT_MEMORY;

  return (
    <div className="grid">
      <section className="panel">
        <h2>Modo de execução</h2>
        <p className="sub">
          Efetivo agora: <span className="pill">{effectiveMode}</span>
          {!view.liveReady && view.mode === "live"
            ? " — live pedido, mas sem keys → cai para demo"
            : null}
        </p>
        <label className="field">
          <span>Mode</span>
          <select
            value={view.mode}
            onChange={(e) =>
              setView({ ...view, mode: e.target.value as "demo" | "live" })
            }
          >
            <option value="demo">demo — roda sem API keys</option>
            <option value="live">live — usa providers reais</option>
          </select>
        </label>
        <label className="field">
          <span>Sandbox</span>
          <select
            value={view.sandbox}
            onChange={(e) =>
              setView({
                ...view,
                sandbox: e.target.value as SettingsView["sandbox"],
              })
            }
          >
            <option value="local">local</option>
            <option value="docker">docker</option>
            <option value="firecracker">firecracker (Linux/WSL2)</option>
          </select>
        </label>
      </section>

      <section className="panel">
        <h2>Memory (Obsidian)</h2>
        <p className="sub">
          Vault markdown Obsidian-compatible. Vazio ={" "}
          <code className="mono">.harness/vault</code>. Vault externo escreve só em{" "}
          <code className="mono">Harness/&lt;projectId&gt;/</code>.
        </p>
        <label className="field">
          <span>Kind</span>
          <select
            value={memory.kind}
            onChange={(e) =>
              setView({
                ...view,
                memory: {
                  ...memory,
                  kind: e.target.value as "none" | "obsidian",
                },
              })
            }
          >
            <option value="obsidian">obsidian — vault markdown</option>
            <option value="none">none — desligado</option>
          </select>
        </label>
        <label className="field">
          <span>Vault path (opcional)</span>
          <input
            placeholder=".harness/vault (default)"
            value={memory.vaultPath}
            onChange={(e) =>
              setView({
                ...view,
                memory: { ...memory, vaultPath: e.target.value },
              })
            }
          />
        </label>
        <label className="field">
          <span>Project id (namespace)</span>
          <input
            value={memory.projectId}
            onChange={(e) =>
              setView({
                ...view,
                memory: { ...memory, projectId: e.target.value },
              })
            }
          />
        </label>
        <label className="field">
          <span>Hydrate limit</span>
          <input
            type="number"
            min={5}
            max={100}
            value={memory.hydrateLimit}
            onChange={(e) =>
              setView({
                ...view,
                memory: {
                  ...memory,
                  hydrateLimit: Number(e.target.value) || 20,
                },
              })
            }
          />
        </label>
      </section>

      <section className="panel">
        <h2>API keys</h2>
        <p className="sub">
          Opcionais em demo. Salvas só em{" "}
          <code className="mono">.harness/settings.json</code> (gitignored).
        </p>
        {Object.keys(SECRET_LABELS).map((key) => (
          <label className="field" key={key}>
            <span>
              {SECRET_LABELS[key]}{" "}
              {view.secrets[key]?.set ? (
                <span className="pill ok">
                  configurada {view.secrets[key]?.masked}
                </span>
              ) : (
                <span className="pill">vazia</span>
              )}
            </span>
            <input
              type="password"
              placeholder={
                view.secrets[key]?.set
                  ? "Nova key (deixe vazio para manter)"
                  : "Cole a API key"
              }
              value={draftSecrets[key] ?? ""}
              onChange={(e) =>
                setDraftSecrets({ ...draftSecrets, [key]: e.target.value })
              }
            />
            {view.secrets[key]?.set ? (
              <button
                type="button"
                className="btn secondary"
                style={{ marginTop: "0.4rem" }}
                onClick={() =>
                  setDraftSecrets({ ...draftSecrets, [key]: "__CLEAR__" })
                }
              >
                Limpar key
              </button>
            ) : null}
          </label>
        ))}
      </section>

      <section className="panel">
        <h2>Defaults de run</h2>
        <label className="field">
          <span>Vertical</span>
          <select
            value={view.defaults.vertical}
            onChange={(e) =>
              setView({
                ...view,
                defaults: { ...view.defaults, vertical: e.target.value },
              })
            }
          >
            <option value="coding">coding</option>
            <option value="unreal-cpp">unreal-cpp</option>
          </select>
        </label>
        <label className="field">
          <span>Workspace</span>
          <input
            value={view.defaults.workspace}
            onChange={(e) =>
              setView({
                ...view,
                defaults: { ...view.defaults, workspace: e.target.value },
              })
            }
          />
        </label>
        <label className="field">
          <span>Brief padrão</span>
          <textarea
            rows={3}
            value={view.defaults.brief}
            onChange={(e) =>
              setView({
                ...view,
                defaults: { ...view.defaults, brief: e.target.value },
              })
            }
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={view.defaults.autoApprove}
            onChange={(e) =>
              setView({
                ...view,
                defaults: { ...view.defaults, autoApprove: e.target.checked },
              })
            }
          />
          Auto-approve HITL (também ligado automaticamente em demo)
        </label>
      </section>

      <div>
        <button className="btn" disabled={busy} onClick={() => void save()}>
          Salvar configurações
        </button>
        {status ? <p className="sub">{status}</p> : null}
      </div>
    </div>
  );
}
