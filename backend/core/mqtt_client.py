"""
Cliente MQTT (HiveMQ Cloud / Mosquitto) para falar com o ESP32.

O Django publica em cmnd/estoque/relay e assina stat/estoque/#.
O ESP32 na outra rede só precisa de Wi-Fi com internet — os dois saem até o broker.
"""

from __future__ import annotations

import json
import logging
import ssl
import threading
from typing import Any

import certifi
from django.conf import settings
from django.db import close_old_connections
from django.utils import timezone

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_client = None
_connected = False
_started = False


class MqttError(Exception):
    """Broker não configurado ou falha ao publicar."""


def mqtt_is_configured() -> bool:
    host = (getattr(settings, "MQTT_HOST", None) or "").strip()
    return bool(host)


def mqtt_broker_connected() -> bool:
    return _connected


def parse_mqtt_payload(raw: bytes | str | None) -> dict[str, Any]:
    if raw is None:
        return {}
    text = raw.decode("utf-8", errors="replace").strip() if isinstance(raw, bytes) else str(raw).strip()
    if not text:
        return {}
    lowered = text.lower()
    if lowered in ("online", "offline"):
        return {"online": lowered == "online"}
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return {"raw": text}
    if isinstance(data, dict):
        return data
    return {"value": data}


def snapshot_to_dict(obj) -> dict[str, Any]:
    return {
        "online": bool(obj.online),
        "relay_on": obj.relay_on,
        "weight": obj.weight,
        "payload": obj.payload or {},
        "last_seen": obj.last_seen.isoformat() if obj.last_seen else None,
        "last_command": obj.last_command,
        "last_command_at": obj.last_command_at.isoformat() if obj.last_command_at else None,
        "mqtt_error": obj.mqtt_error or "",
        "mqtt_configured": mqtt_is_configured(),
        "mqtt_connected": mqtt_broker_connected(),
        "topics": {
            "command": getattr(settings, "MQTT_TOPIC_CMND", "cmnd/estoque/relay"),
            "status": getattr(settings, "MQTT_TOPIC_STATUS", "stat/estoque/status"),
            "lwt": getattr(settings, "MQTT_TOPIC_LWT", "stat/estoque/lwt"),
        },
    }


def get_snapshot():
    from .models import Esp32Snapshot

    obj, _ = Esp32Snapshot.objects.get_or_create(pk=1)
    return obj


def apply_incoming_message(topic: str, raw: bytes | str | None) -> dict[str, Any]:
    """Atualiza o snapshot no banco a partir de uma mensagem MQTT (também usado nos testes)."""
    payload = parse_mqtt_payload(raw)
    close_old_connections()
    obj = get_snapshot()
    obj.last_seen = timezone.now()
    obj.mqtt_error = ""

    lwt_topic = getattr(settings, "MQTT_TOPIC_LWT", "stat/estoque/lwt")
    if topic == lwt_topic or "online" in payload:
        if "online" in payload:
            obj.online = bool(payload["online"])
        elif payload.get("raw") == "offline":
            obj.online = False
        else:
            obj.online = True
    else:
        obj.online = True

    if "relay" in payload:
        obj.relay_on = bool(payload["relay"])
    elif "on" in payload:
        obj.relay_on = bool(payload["on"])

    if payload.get("weight") is not None:
        try:
            obj.weight = float(payload["weight"])
        except (TypeError, ValueError):
            pass

    merged = dict(obj.payload or {})
    merged.update(payload)
    obj.payload = merged
    obj.save()
    return snapshot_to_dict(obj)


def record_command(command: dict[str, Any], error: str = "") -> None:
    close_old_connections()
    obj = get_snapshot()
    obj.last_command = command
    obj.last_command_at = timezone.now()
    obj.mqtt_error = error
    obj.save()


def _on_connect(client, userdata, flags, reason_code, properties=None):
    global _connected
    ok = getattr(reason_code, "is_failure", None)
    if ok is False or reason_code == 0:
        _connected = True
        status_topic = getattr(settings, "MQTT_TOPIC_STATUS", "stat/estoque/status")
        lwt_topic = getattr(settings, "MQTT_TOPIC_LWT", "stat/estoque/lwt")
        client.subscribe([(status_topic, 1), (lwt_topic, 1)])
        logger.info("MQTT conectado; inscrito em %s e %s", status_topic, lwt_topic)
        return
    _connected = False
    logger.warning("MQTT connect falhou: %s", reason_code)


def _on_disconnect(client, userdata, flags, reason_code, properties=None):
    global _connected
    _connected = False
    logger.info("MQTT desconectado: %s", reason_code)


def _on_message(client, userdata, message):
    try:
        apply_incoming_message(message.topic, message.payload)
    except Exception:
        logger.exception("Falha ao processar MQTT %s", getattr(message, "topic", "?"))


def _build_client():
    try:
        import paho.mqtt.client as mqtt
    except ImportError as exc:
        raise MqttError("Instale paho-mqtt: pip install paho-mqtt") from exc

    client_id = (getattr(settings, "MQTT_CLIENT_ID", None) or "stocksystem-django").strip()
    kwargs: dict[str, Any] = {"client_id": client_id, "protocol": mqtt.MQTTv311}
    if hasattr(mqtt, "CallbackAPIVersion"):
        kwargs["callback_api_version"] = mqtt.CallbackAPIVersion.VERSION2
    client = mqtt.Client(**kwargs)

    user = (getattr(settings, "MQTT_USERNAME", None) or "").strip()
    password = getattr(settings, "MQTT_PASSWORD", None) or ""
    if user:
        client.username_pw_set(user, password)

    if getattr(settings, "MQTT_TLS", True):
        client.tls_set(ca_certs=certifi.where(), tls_version=ssl.PROTOCOL_TLS_CLIENT)

    client.on_connect = _on_connect
    client.on_disconnect = _on_disconnect
    client.on_message = _on_message
    return client


def _ensure_client():
    global _client
    with _lock:
        if _client is None:
            _client = _build_client()
        return _client


def start_background_listener() -> None:
    """Conecta e mantém o loop MQTT (assina status). Idempotente."""
    global _started
    if not mqtt_is_configured():
        return
    with _lock:
        if _started:
            return
        _started = True
    host = settings.MQTT_HOST.strip()
    port = int(getattr(settings, "MQTT_PORT", 8883) or 8883)
    client = _ensure_client()
    try:
        client.connect(host, port, keepalive=60)
        client.loop_start()
        logger.info("MQTT listener iniciado em %s:%s", host, port)
    except Exception:
        global _started
        _started = False
        logger.exception("Não foi possível conectar ao MQTT %s:%s", host, port)


def publish_relay(on: bool) -> dict[str, Any]:
    """Publica {"on": true|false} em cmnd/estoque/relay (QoS 1, retained)."""
    command = {"on": bool(on)}
    return publish_command(command)


def publish_command(command: dict[str, Any]) -> dict[str, Any]:
    if not mqtt_is_configured():
        raise MqttError(
            "MQTT não configurado. Defina MQTT_HOST, MQTT_USERNAME e MQTT_PASSWORD no backend/.env"
        )
    topic = getattr(settings, "MQTT_TOPIC_CMND", "cmnd/estoque/relay")
    payload = json.dumps(command)
    start_background_listener()
    deadline = timezone.now().timestamp() + 6
    while not mqtt_broker_connected() and timezone.now().timestamp() < deadline:
        import time

        time.sleep(0.2)
    client = _ensure_client()
    info = client.publish(topic, payload, qos=1, retain=True)
    try:
        info.wait_for_publish(timeout=8)
    except Exception as exc:
        record_command(command, error=str(exc))
        raise MqttError(f"Timeout ao publicar no broker: {exc}") from exc
    if getattr(info, "rc", 0) not in (0, None) and not getattr(info, "is_published", lambda: True)():
        record_command(command, error="publish rc != 0")
        raise MqttError("Broker recusou o publish.")
    record_command(command)
    return {"ok": True, "topic": topic, "command": command, **snapshot_to_dict(get_snapshot())}


def should_start_mqtt_on_ready() -> bool:
    """Evita conectar durante migrate/testes/reloader do runserver."""
    import os
    import sys

    if not mqtt_is_configured():
        return False
    argv = " ".join(sys.argv).lower()
    skip = (
        "migrate",
        "makemigrations",
        "collectstatic",
        "test",
        "qcluster",
        "shell",
        "createsuperuser",
        "loaddata",
        "dumpdata",
    )
    if any(cmd in argv for cmd in skip):
        return False
    if "runserver" in argv and os.environ.get("RUN_MAIN") != "true":
        return False
    return True
