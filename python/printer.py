#!/usr/bin/env python3
"""One-shot Bambu printer status reader.

Connects to the printer over MQTT (via the vendored bambulabs_api), reads the
current state once, prints it as JSON to stdout, and exits. Invoked as a
subprocess by the TS dashboard. Config comes from the environment
(PRINTER_IP / PRINTER_SERIAL / PRINTER_ACCESS_CODE), inherited from the
parent's .env.
"""
import json
import os
import socket
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import bambulabs_api as bl  # noqa: E402

IP = os.environ.get("PRINTER_IP", "").strip()
SERIAL = os.environ.get("PRINTER_SERIAL", "").strip()
CODE = os.environ.get("PRINTER_ACCESS_CODE", "").strip()

# MQTT-over-TLS port; a quick reachability check avoids a long connect hang.
MQTT_PORT = 8883


def reachable(ip: str, timeout: float = 2.0) -> bool:
    try:
        with socket.create_connection((ip, MQTT_PORT), timeout=timeout):
            return True
    except OSError:
        return False


def main():
    if not (IP and SERIAL and CODE):
        print(json.dumps({"error": "not_configured"}))
        return
    if not reachable(IP):
        print(json.dumps({"status": "OFFLINE"}))
        return

    printer = bl.Printer(IP, CODE, SERIAL)
    try:
        printer.connect()
        time.sleep(3)  # let MQTT receive the first status payload
        status = str(printer.get_state())
        if not status or status == "UNKNOWN":
            print(json.dumps({"status": "OFFLINE"}))
        else:
            print(json.dumps({
                "status": status,
                "percentage": printer.get_percentage(),
                "remaining_time": printer.get_time(),
                "layers": f"{printer.current_layer_num()}/{printer.total_layer_num()}",
            }))
    except Exception as e:  # noqa: BLE001 - dashboard must never crash
        print(json.dumps({"status": "OFFLINE", "error": str(e)}))
    finally:
        try:
            printer.disconnect()
        except Exception:
            pass


if __name__ == "__main__":
    main()
