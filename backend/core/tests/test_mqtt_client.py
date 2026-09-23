"""Helpers MQTT (parse de payload) sem broker real."""

from __future__ import annotations

import os
import unittest
from unittest.mock import patch

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "sistema_gestao.settings")

try:
    import django

    django.setup()
except ModuleNotFoundError:  # pragma: no cover
    django = None  # type: ignore[assignment]

if django is not None:
    from core.mqtt_client import (  # noqa: E402
        MqttError,
        mqtt_is_configured,
        parse_mqtt_payload,
        publish_relay,
        should_start_mqtt_on_ready,
    )


@unittest.skipUnless(django is not None, "Requer Django instalado (ex.: venv do projeto)")
class _MqttTestCase(unittest.TestCase):
    pass


class ParseMqttPayloadTests(_MqttTestCase):
    def test_json_on(self) -> None:
        self.assertEqual(parse_mqtt_payload(b'{"on": true, "weight": 1.5}'), {"on": True, "weight": 1.5})

    def test_online_text(self) -> None:
        self.assertEqual(parse_mqtt_payload("offline"), {"online": False})
        self.assertEqual(parse_mqtt_payload(b"online"), {"online": True})

    def test_invalid_json(self) -> None:
        self.assertEqual(parse_mqtt_payload("nao-json"), {"raw": "nao-json"})

    def test_empty(self) -> None:
        self.assertEqual(parse_mqtt_payload(b""), {})
        self.assertEqual(parse_mqtt_payload(None), {})


class MqttConfigTests(_MqttTestCase):
    def test_not_configured_without_host(self) -> None:
        with patch("core.mqtt_client.settings") as mock_settings:
            mock_settings.MQTT_HOST = ""
            self.assertFalse(mqtt_is_configured())

    def test_publish_without_host_raises(self) -> None:
        with patch("core.mqtt_client.mqtt_is_configured", return_value=False):
            with self.assertRaises(MqttError):
                publish_relay(True)

    def test_skip_listener_during_migrate(self) -> None:
        with patch("core.mqtt_client.mqtt_is_configured", return_value=True):
            with patch("sys.argv", ["manage.py", "migrate"]):
                self.assertFalse(should_start_mqtt_on_ready())


if __name__ == "__main__":
    unittest.main()
