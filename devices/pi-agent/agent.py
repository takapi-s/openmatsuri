#!/usr/bin/env python3
"""Raspberry Pi GPS agent — posts location to OpenMATSURI Ingest API."""

import os
import time
import json
import urllib.request

INTERVAL = int(os.environ.get("INTERVAL_SEC", "5"))
TOKEN = os.environ["TRACKER_TOKEN"]
ENDPOINT = os.environ.get(
    "INGEST_ENDPOINT", "http://127.0.0.1:54321/functions/v1/ingest-location"
)
ANON_KEY = os.environ["SUPABASE_ANON_KEY"]

# Requires gpsd running: gpspipe -w -n 1


def get_location():
    import subprocess

    result = subprocess.run(
        ["gpspipe", "-w", "-n", "5"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    for line in result.stdout.splitlines():
        data = json.loads(line)
        if data.get("class") == "TPV" and "lat" in data and "lon" in data:
            return data["lat"], data["lon"]
    return None


def post_location(lat, lon):
    payload = json.dumps(
        {
            "token": TOKEN,
            "lat": lat,
            "lng": lon,
            "source": "pi_agent",
        }
    ).encode()
    req = urllib.request.Request(
        ENDPOINT,
        data=payload,
        headers={
            "Authorization": f"Bearer {ANON_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.status == 200


def main():
    while True:
        loc = get_location()
        if loc:
            ok = post_location(*loc)
            print(f"sent {loc} ok={ok}")
        else:
            print("no gps fix")
        time.sleep(INTERVAL)


if __name__ == "__main__":
    main()
