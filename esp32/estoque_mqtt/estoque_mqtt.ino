/*
  StockSystem — firmware MQTT para ESP32 (HiveMQ Cloud).

  Bibliotecas (Arduino Library Manager):
    - PubSubClient (Nick O'Leary)
    - ArduinoJson

  Placa: ESP32 Dev Module. GPIO 2 = LED/relé (mude RELAY_PIN se precisar).

  Fluxo:
    Django  --publish-->  cmnd/estoque/relay   {"on": true}
    ESP32   --publish-->  stat/estoque/status  {"online": true, "relay": true, "weight": 0}
    Broker  --LWT------>  stat/estoque/lwt     {"online": false}  se o módulo cair
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// --- preencha ---
const char* WIFI_SSID = "SUA_REDE";
const char* WIFI_PASSWORD = "SUA_SENHA";

const char* MQTT_HOST = "xxxxx.s1.eu.hivemq.cloud";
const uint16_t MQTT_PORT = 8883;
const char* MQTT_USER = "usuario_hivemq";
const char* MQTT_PASSWORD = "senha_hivemq";
const char* MQTT_CLIENT_ID = "stocksystem-esp32";

const char* TOPIC_CMND = "cmnd/estoque/relay";
const char* TOPIC_STATUS = "stat/estoque/status";
const char* TOPIC_LWT = "stat/estoque/lwt";

const int RELAY_PIN = 2;
const unsigned long STATUS_EVERY_MS = 15000;

WiFiClientSecure net;
PubSubClient mqtt(net);

bool relayOn = false;
unsigned long lastStatus = 0;

void publishStatus() {
  StaticJsonDocument<192> doc;
  doc["online"] = true;
  doc["relay"] = relayOn;
  doc["weight"] = 0;
  char buf[192];
  serializeJson(doc, buf);
  mqtt.publish(TOPIC_STATUS, buf, true);
}

void applyRelay(bool on) {
  relayOn = on;
  digitalWrite(RELAY_PIN, on ? HIGH : LOW);
  publishStatus();
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  char msg[256];
  unsigned int n = length < sizeof(msg) - 1 ? length : sizeof(msg) - 1;
  memcpy(msg, payload, n);
  msg[n] = 0;

  StaticJsonDocument<256> doc;
  if (deserializeJson(doc, msg)) {
    return;
  }
  if (!doc["on"].isNull()) {
    applyRelay(doc["on"].as<bool>());
  }
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
  }
}

void connectMqtt() {
  while (!mqtt.connected()) {
    StaticJsonDocument<64> lwt;
    lwt["online"] = false;
    char lwtBuf[64];
    serializeJson(lwt, lwtBuf);
    if (mqtt.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASSWORD, TOPIC_LWT, 1, true, lwtBuf)) {
      mqtt.subscribe(TOPIC_CMND, 1);
      StaticJsonDocument<64> online;
      online["online"] = true;
      char onlineBuf[64];
      serializeJson(online, onlineBuf);
      mqtt.publish(TOPIC_LWT, onlineBuf, true);
      publishStatus();
    } else {
      delay(2000);
    }
  }
}

void setup() {
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  connectWifi();
  net.setInsecure();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setBufferSize(512);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }
  if (!mqtt.connected()) {
    connectMqtt();
  }
  mqtt.loop();
  unsigned long now = millis();
  if (now - lastStatus >= STATUS_EVERY_MS) {
    lastStatus = now;
    publishStatus();
  }
}
