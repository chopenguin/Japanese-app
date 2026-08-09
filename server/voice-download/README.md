# Japanese Voice Download Server Runbook

This Compose project serves the app's voice packs from a read-only Caddy container.

- Remote location: `/home/jimmy/docker/japanese-voice-download`
- Caddy shares only the Tailscale sidecar's network namespace; no host TCP port is published.
- Public HTTPS is provided only through Tailscale Funnel to `http://127.0.0.1:8080` inside that shared namespace.
- The container cannot write to the voice-pack directory.
- Caddy is limited to 0.5 CPU, 192 MB RAM and 64 processes. Tailscale is limited to 0.25 CPU, 192 MB RAM and 64 processes. Both have bounded tmpfs and log sizes.
- The root filesystem and voice mounts are read-only. All Linux capabilities are dropped except Caddy's required `NET_BIND_SERVICE`; privilege escalation is disabled.
- Tailscale uses userspace networking, has no Linux capabilities or host devices, and stores only its identity in the `tailscale-state` Docker volume.

## Production endpoint

```text
https://japanese-voice-download.tailb5ba7a.ts.net/voices
```

GitHub Actions repository variable:

```text
VOICE_PACK_BASE_URL=https://japanese-voice-download.tailb5ba7a.ts.net/voices
```

## Sync from Windows

Run from the repository root. Robocopy updates and adds files but does not remove extra destination files:

```powershell
robocopy .\public\audio\voices S:\docker\japanese-voice-download\voices /E /Z /J /R:3 /W:3 /MT:16

Copy-Item -LiteralPath `
  .\server\voice-download\Caddyfile, `
  .\server\voice-download\compose.yaml, `
  .\server\voice-download\README.md `
  -Destination S:\docker\japanese-voice-download -Force
```

## Deploy or update

```bash
ssh home
cd /home/jimmy/docker/japanese-voice-download
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose ps
```

Do not use `docker compose down -v` during normal maintenance. The `-v` option deletes the `tailscale-state` volume and forces a new device login.

## Funnel operations

```bash
# Show the current public mapping.
docker exec japanese-voice-tunnel tailscale funnel status

# Enable or repair the public mapping.
docker exec japanese-voice-tunnel tailscale funnel --yes --bg http://127.0.0.1:8080

# Disable public access without deleting identity or stopping containers.
docker exec japanese-voice-tunnel tailscale funnel --https=443 off
```

If `tailscale status` reports `Logged out`, open the URL shown by `docker compose logs voice-tunnel`, sign in, select **Connect device**, then enable Funnel again. The first Funnel setup can also require approval in the Tailscale admin page.

## Verification

From Windows:

```powershell
curl.exe --fail --head https://japanese-voice-download.tailb5ba7a.ts.net/voices/index.json
curl.exe --fail --range 0-99 -o NUL https://japanese-voice-download.tailb5ba7a.ts.net/voices/gpt-sovits-custom/N5/n5-0001.wav
```

On the server:

```bash
docker compose ps
docker compose logs --tail=100
docker stats japanese-voice-download japanese-voice-tunnel --no-stream
docker exec japanese-voice-tunnel tailscale status
docker exec japanese-voice-tunnel tailscale funnel status
```

Expected results:

- `japanese-voice-download` is `healthy`.
- The index request returns `200`.
- A ranged WAV request returns `206` and `Content-Range`.
- `docker port` returns no published host ports for either container.
- Memory limits show `192MiB` for each container.

## Resource and privilege boundaries

| Container | CPU | Memory | PID limit | Privilege boundary |
| --- | ---: | ---: | ---: | --- |
| `japanese-voice-download` | 0.50 | 192 MB | 64 | Read-only, non-privileged, only `NET_BIND_SERVICE` |
| `japanese-voice-tunnel` | 0.25 | 192 MB | 64 | Read-only, non-privileged, all capabilities dropped |

Both containers use bounded tmpfs and rotating 10 MB logs. No Docker socket or host device is mounted. Caddy can only read `./voices`; Tailscale stores its persistent identity only in the named volume.
