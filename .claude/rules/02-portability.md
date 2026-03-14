# Portability: Container & Cloud-Native (2025)

## Dockerfile requirements (EVERY service)

1. **Multi-stage build** — separate build and runtime stages. Final image: zero build tools.
2. **Minimal base** — Alpine-based or distroless images. Never full OS images without justification.
3. **Non-root** — `USER 1001`. Port <1024 -> use `setcap`, not root.
4. **Read-only fs** — `read_only: true` in compose + `tmpfs: /tmp`.
5. **No secrets in image** — no `COPY .env`, no `ARG PASSWORD`. Runtime env or mounted secrets.
6. **Pin digest** — `FROM image@sha256:...` not just tag. Reproducible builds.
7. **HEALTHCHECK** — in every Dockerfile, timeout <5s.
8. **.dockerignore** — exclude: `.git`, `node_modules`, `.env*`, `*.md`, `tests/`.

## 12-Factor App (MANDATORY)

| Factor | Rule |
|--------|------|
| Config | ALL config via env vars. Zero hardcoded URLs/ports/credentials. |
| Processes | Stateless. No local file storage for user data. Object storage or DB. |
| Port binding | `$PORT`, default 8080. Zero hardcoded ports. |
| Logs | stdout/stderr ONLY. Never log files. JSON structured logging. |
| Disposability | Startup <5s. Graceful shutdown on SIGTERM: drain, disconnect, exit(0). |
| Dev/prod parity | Docker Compose locally mirrors production topology. |
| Dependencies | Explicitly declared. No system-level assumptions. |

## Graceful shutdown (REQUIRED pattern)

```typescript
process.on('SIGTERM', async () => {
  server.close();
  await drainConnections(); // max 30s
  await db.disconnect();
  process.exit(0);
});
```

## Health endpoints

- `GET /healthz` — liveness: 200 if process alive. No dependency checks.
- `GET /readyz` — readiness: 200 only when DB/cache reachable.

## Haven compliance (active standard, VNG 2019-2026)

Haven is the Dutch government standard for platform-independent Kubernetes hosting.
Compliance means workloads can migrate between any Haven cluster without modification.

- Helm chart in `deploy/helm/`. No `hostPath`, `privileged`, `hostNetwork`.
- Resource limits REQUIRED: `limits.memory` + `limits.cpu`.
- `NetworkPolicy` default-deny ingress, explicit allow per service.
- Run Haven Compliancy Checker (`haven check`) to validate cluster compliance.
- Common Ground applications MUST be Haven-compatible.
