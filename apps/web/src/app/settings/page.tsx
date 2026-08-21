import { SettingsForm } from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <>
      <h1>Configurações</h1>
      <p className="sub">
        Guarde API keys e preferências aqui. O harness roda em{" "}
        <strong>demo</strong> sem nenhuma key — ative <strong>live</strong> quando
        quiser providers reais.
      </p>
      <SettingsForm />
    </>
  );
}
