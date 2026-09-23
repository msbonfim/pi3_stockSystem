import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, Power } from "lucide-react";

const API_BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8000/api"
    : "https://pi2-stocksystem-backend.onrender.com/api";

type Esp32Status = {
  online: boolean;
  relay_on: boolean | null;
  weight: number | null;
  payload: Record<string, unknown>;
  last_seen: string | null;
  last_command: Record<string, unknown> | null;
  last_command_at: string | null;
  mqtt_error: string;
  mqtt_configured: boolean;
  mqtt_connected: boolean;
  topics: { command: string; status: string; lwt: string };
  error?: string;
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR") : "—";

export default function Esp32Page() {
  const [status, setStatus] = useState<Esp32Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadStatus() {
    try {
      const res = await fetch(`${API_BASE}/esp32/status/`);
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch {
      setError("Não foi possível falar com o backend Django.");
    }
  }

  async function setRelay(on: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/esp32/relay/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ on }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Falha ao publicar no MQTT.");
        return;
      }
      setStatus(data);
    } catch {
      setError("Erro de rede ao publicar o comando.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadStatus();
    const id = window.setInterval(loadStatus, 2500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">ESP32 (MQTT)</h1>
            <p className="text-muted-foreground">
              O Django local publica no HiveMQ; o módulo em outra rede assina o tópico.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/">Estoque</Link>
          </Button>
        </div>

        {error && (
          <Card>
            <CardContent className="pt-4 text-destructive">{error}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              Estado
            </CardTitle>
            <CardDescription>
              Preencha MQTT_HOST / MQTT_USERNAME / MQTT_PASSWORD em backend/.env e rode migrate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={status?.mqtt_configured ? "default" : "destructive"}>
                Broker {status?.mqtt_configured ? "configurado" : "não configurado"}
              </Badge>
              <Badge variant={status?.mqtt_connected ? "default" : "secondary"}>
                Django {status?.mqtt_connected ? "conectado" : "desconectado"}
              </Badge>
              <Badge variant={status?.online ? "default" : "secondary"}>
                ESP32 {status?.online ? "online" : "offline"}
              </Badge>
              <Badge variant={status?.relay_on ? "default" : "outline"}>
                Relé {status?.relay_on == null ? "—" : status.relay_on ? "ligado" : "desligado"}
              </Badge>
            </div>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Peso</dt>
                <dd>{status?.weight == null ? "—" : `${status.weight}`}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Última mensagem</dt>
                <dd>{fmt(status?.last_seen ?? null)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Último comando</dt>
                <dd>{status?.last_command ? JSON.stringify(status.last_command) : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Comando em</dt>
                <dd>{fmt(status?.last_command_at ?? null)}</dd>
              </div>
            </dl>
            {status?.mqtt_error ? (
              <p className="text-sm text-destructive">{status.mqtt_error}</p>
            ) : null}
            <div className="flex gap-2">
              <Button onClick={() => setRelay(true)} disabled={busy || !status?.mqtt_configured}>
                <Power className="mr-2 h-4 w-4" />
                Ligar relé
              </Button>
              <Button
                variant="outline"
                onClick={() => setRelay(false)}
                disabled={busy || !status?.mqtt_configured}
              >
                Desligar relé
              </Button>
            </div>
            {status?.topics ? (
              <p className="text-xs text-muted-foreground">
                cmnd: {status.topics.command} · stat: {status.topics.status} · lwt: {status.topics.lwt}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
