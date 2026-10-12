# /// script
# requires-python = ">=3.9"
# dependencies = ["boto3", "websockets>=14"]
# ///
"""Open the workstation's terminal from a local shell.

    python3 connect.py <runtime-arn> <session-id>

Uses the usual AWS credentials (AWS_PROFILE, CloudShell's own, and so on). A stopped session takes about
a minute to start before the shell appears. Leave with `exit`.
"""
import asyncio
import base64
import datetime
import os
import secrets
import sys
import termios
import tty
from urllib.parse import quote

import boto3
import websockets
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest


def signed_connection(runtime_arn: str, session_id: str):
    region = runtime_arn.split(":")[3]
    host = f"bedrock-agentcore.{region}.amazonaws.com"
    path = f"/runtimes/{quote(runtime_arn, safe='')}/ws"
    credentials = boto3.Session().get_credentials().get_frozen_credentials()
    date = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    request = AWSRequest(method="GET", url=f"https://{host}{path}", headers={"host": host, "x-amz-date": date})
    SigV4Auth(credentials, "bedrock-agentcore", region).add_auth(request)
    headers = {
        "X-Amz-Date": date,
        "Authorization": request.headers["Authorization"],
        "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": session_id,
    }
    if credentials.token:
        headers["X-Amz-Security-Token"] = credentials.token
    return f"wss://{host}{path}", headers


async def main(runtime_arn: str, session_id: str) -> None:
    url, headers = signed_connection(runtime_arn, session_id)
    async with websockets.connect(url, additional_headers=headers, max_size=None, open_timeout=180) as ws:
        loop = asyncio.get_running_loop()
        stdin = sys.stdin.fileno()
        queue = asyncio.Queue()
        loop.add_reader(stdin, lambda: queue.put_nowait(os.read(stdin, 4096)))

        async def send() -> None:
            while True:
                data = await queue.get()
                if not data:
                    return
                await ws.send(data)

        sender = asyncio.create_task(send())
        try:
            async for message in ws:
                os.write(sys.stdout.fileno(), message if isinstance(message, bytes) else message.encode())
        finally:
            sender.cancel()
            loop.remove_reader(stdin)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    saved = termios.tcgetattr(sys.stdin)
    tty.setraw(sys.stdin)
    try:
        asyncio.run(main(sys.argv[1], sys.argv[2]))
    finally:
        termios.tcsetattr(sys.stdin, termios.TCSADRAIN, saved)
        print()
