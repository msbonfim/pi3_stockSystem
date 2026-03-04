// frontend/src/services/pushNotifications.ts

// O script de automação vai preencher o valor abaixo:
export const VAPID_PUBLIC_KEY = "BFPJ8h24o-fVOnFOlcnOv5QLU3pHMvB4tpy0PfBrGSSwjWHHouYQfXzkK6UHgJ_5huuEQiM2Nst0vcEb8R4Bps4";

import { api } from "@/lib/axios";

class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;
  private isInitialized = false;

  public async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      console.log("Push notifications já inicializadas.");
      return true;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("Push notifications não são suportadas neste navegador.");
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.ready;
      console.log("✅ Service Worker pronto!");

      this.subscription = await this.registration.pushManager.getSubscription();

      if (this.subscription) {
        console.log("✅ Subscription já existe:", this.subscription.endpoint);
        this.isInitialized = true;
        return true;
      }

      // Lendo diretamente da constante definida no topo do arquivo
      const vapidPublicKey = VAPID_PUBLIC_KEY;
      if (
        !vapidPublicKey ||
        vapidPublicKey.trim() === "" ||
        vapidPublicKey === "BFPJ8h24o-fVOnFOlcnOv5QLU3pHMvB4tpy0PfBrGSSwjWHHouYQfXzkK6UHgJ_5huuEQiM2Nst0vcEb8R4Bps4"
      ) {
        console.warn(
          "⚠️ Chave VAPID_PUBLIC_KEY não está configurada. Push notifications desabilitadas.",
        );
        this.isInitialized = true;
        return false;
      }

      console.log(
        "⚠️ Nenhuma subscription encontrada. Solicitando permissão...",
      );
      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        console.warn("❌ Permissão para notificações foi negada.");
        this.isInitialized = true;
        return false;
      }

      await this.subscribeUser();
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("❌ Erro ao inicializar push notifications:", error);
      this.isInitialized = true;
      return false;
    }
  }

  private async subscribeUser(): Promise<void> {
    if (!this.registration) {
      console.error("Service Worker não está pronto para criar subscription.");
      return;
    }

    // Lendo diretamente da constante definida no topo do arquivo
    const vapidPublicKey = VAPID_PUBLIC_KEY;
    if (
      !vapidPublicKey ||
      vapidPublicKey.trim() === "" ||
      vapidPublicKey === "BFPJ8h24o-fVOnFOlcnOv5QLU3pHMvB4tpy0PfBrGSSwjWHHouYQfXzkK6UHgJ_5huuEQiM2Nst0vcEb8R4Bps4"
    ) {
      console.warn(
        "⚠️ Chave VAPID_PUBLIC_KEY não está configurada. Push notifications desabilitadas.",
      );
      return;
    }

    try {
      const applicationServerKey = this.urlBase64ToUint8Array(vapidPublicKey);

      const applicationServerKeyBuffer =
        applicationServerKey.buffer as ArrayBuffer;

      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKeyBuffer,
      });

      console.log(
        "✅ Subscription criada localmente:",
        this.subscription.endpoint,
      );
      await this.sendSubscriptionToBackend(this.subscription);
    } catch (error) {
      console.error("❌ Erro ao criar subscription:", error);
    }
  }

  private async sendSubscriptionToBackend(
    sub: PushSubscription,
  ): Promise<void> {
    const subData = sub.toJSON();
    const payload = {
      endpoint: subData.endpoint,
      p256dh: subData.keys?.p256dh,
      auth: subData.keys?.auth,
    };

    console.log("📤 Enviando subscription para o backend:", payload.endpoint);

    try {
      const response = await api.post("/api/push-subscriptions/", payload);
      if (response.status === 201 || response.status === 200) {
        console.log("✅ Subscription salva no backend!");
      } else {
        console.error(
          "❌ Falha ao salvar subscription no backend. Status:",
          response.status,
        );
      }
    } catch (error: any) {
      console.error("❌ Erro de rede ao enviar subscription:", error);
      if (error.response) {
        console.error("Status:", error.response.status);
        console.error("Data:", error.response.data);
      }
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    if (!base64String || typeof base64String !== "string") {
      throw new Error("Invalid base64 string provided");
    }

    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

// Exporta uma única instância da classe para ser usada em todo o app.
export const pushNotificationService = new PushNotificationService();
