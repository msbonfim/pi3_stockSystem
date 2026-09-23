from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0007_sale_saleitem"),
    ]

    operations = [
        migrations.CreateModel(
            name="Esp32Snapshot",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("online", models.BooleanField(default=False, verbose_name="Online")),
                ("relay_on", models.BooleanField(blank=True, null=True, verbose_name="Relé ligado")),
                ("weight", models.FloatField(blank=True, null=True, verbose_name="Peso")),
                ("payload", models.JSONField(blank=True, default=dict, verbose_name="Último payload")),
                ("last_seen", models.DateTimeField(blank=True, null=True, verbose_name="Última mensagem")),
                ("last_command", models.JSONField(blank=True, null=True, verbose_name="Último comando")),
                ("last_command_at", models.DateTimeField(blank=True, null=True, verbose_name="Comando em")),
                ("mqtt_error", models.CharField(blank=True, max_length=300, verbose_name="Erro MQTT")),
            ],
            options={
                "verbose_name": "Estado do ESP32",
                "verbose_name_plural": "Estado do ESP32",
            },
        ),
    ]
