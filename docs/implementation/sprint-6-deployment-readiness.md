# Sprint 6 — Deployment and environment readiness

## Readiness result

The repository has development and production Compose definitions, Dockerfiles, environment examples, and container health checks. This is a deployment foundation, not evidence that a staging or production environment was deployed or smoke-tested. No services were started and no production infrastructure was changed for this review.

Do not deploy directly from the current working tree: it contains pre-existing and Sprint 5 uncommitted changes. Review and approve a clean release artifact first, then deploy only to an isolated staging environment.

## Environment separation

| Environment | Configuration | Dependency behavior | Deployment notes |
| --- | --- | --- | --- |
| Local development | Root `.env.example` and `poshanai-backend/.env.example`; `docker-compose.yml` provides MongoDB, Redis, API, OCR worker, and web containers. | MongoDB is required. Redis is optional for local synchronous paths, but Compose includes it. File storage defaults to local. | `npm run dev` is the repository development entry point; Vite defaults to port 5173 and proxies `/api` to API port 5000. Do not reuse production credentials or data. |
| Staging | No dedicated staging Compose or checked-in staging environment file exists. Use a separately managed environment and secret store. | Mirror production dependencies and settings, including authenticated MongoDB, Redis, TLS, durable report storage, and the correct public origin. | Use isolated databases, buckets, Redis, OAuth/email settings, and test accounts. Exercise `/health/live` and `/health/ready` before browser acceptance testing. |
| Production | `docker-compose.prod.yml` and `.env.production.example`. | MongoDB, Redis, and S3-compatible storage are required by the production configuration. Production rate limiting fails closed if Redis is unavailable. | Compose does not publish MongoDB or Redis ports. The web container serves HTTPS and proxies API requests. Configure real TLS certificates and an explicit trusted proxy hop count. |

Production Compose mounts `report_uploads` while the checked-in production example selects `STORAGE_TYPE=s3`. The volume is therefore unused in S3 mode; confirm which storage mode is intended for the target deployment and provision S3 settings or explicitly select a persistent local-storage design. Never assume an ephemeral container filesystem is durable.

## Environment-variable checklist

Set values through a secret manager or protected deployment environment. Do not paste production values into docs, CI logs, command history, or browser bundles.

### Required for production startup

- `NODE_ENV=production`.
- `MONGODB_URI`: authenticated production MongoDB connection string with an explicit database and least-privilege application user. Use a private network path.
- `MONGODB_TLS=true` for remote MongoDB. `env.js` defaults TLS on for non-local production hosts and rejects remote production MongoDB with TLS disabled.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`: distinct, high-entropy values of at least 32 characters. Do not use the shared `JWT_SECRET` compatibility fallback in production.
- `REDIS_URL`: authenticated `redis://` or `rediss://` URL. Required by `env.js` in production. URL-encode special characters in credentials.
- `CLIENT_ORIGIN`: exact public frontend origin, including scheme and host, with no path. This is used for credentialed CORS.
- `TRUST_PROXY_HOPS`: set to the actual trusted proxy chain. The production default is one hop; verify it against the deployed load balancer/reverse proxy.
- `STORAGE_TYPE=s3`, `S3_BUCKET`, and `S3_REGION` for the production default. Supply both `S3_ACCESS_KEY` and `S3_SECRET_KEY`, or use the AWS default credential provider/role. `S3_KMS_KEY_ID` is supported when KMS encryption is required.

### Required when the corresponding feature is enabled

- `OMNIROUTE_URL`, `OMNIROUTE_MODEL`, and server-only `OMNIROUTE_API_KEY` for the configured AI gateway. The source defaults the URL to a localhost endpoint; explicitly configure the reachable production gateway if AI calls are expected. Static recipe instructions remain the fallback for supported recipe flows.
- `GMAIL_USER` and `GMAIL_PASS` when email/OTP delivery is enabled. Keep email verification disabled for the current MVP unless its separate feature is deliberately re-enabled.
- `FDC_API_KEY` for FoodData Central API access. This is optional to the existing bundled IFCT lookup and must remain server-side.
- `REPORT_RETENTION_DAYS` when the default retention period needs adjustment; verify legal and product requirements before setting it.
- `LOG_LEVEL` to tune Winston verbosity. Avoid debug request payloads in production.

### Stable cryptographic configuration

- `ENCRYPTION_KEY` and `SIGNING_KEY` are supported. For local encrypted report storage, `ENCRYPTION_KEY` must remain stable while stored files exist; the current fallback derives it from `JWT_ACCESS_SECRET`, so rotating that JWT secret without a separately managed stable encryption key can make locally encrypted files unreadable. Validate key encoding/length before enabling this mode.
- S3 objects use the S3 encryption mode configured by the storage service (`AES256`, or KMS when `S3_KMS_KEY_ID` is set). Protect KMS permissions and recovery access separately.
- `JWT_ACCESS_EXPIRY` and `JWT_REFRESH_EXPIRY` default to `15m` and `7d`; review them for the beta threat model.

### Frontend build-time configuration

- `VITE_API_URL` is optional. The Axios client defaults to `/api/v1`; production Nginx proxies `/api/` to the backend, while Vite development proxies `/api` to `http://127.0.0.1:5000`.
- Vite variables are compiled into browser assets. Never put secrets, database URLs, AI keys, or storage credentials in `VITE_*` variables.
- The API retains `/api` as a compatibility route alias; `/api/v1` is canonical.

### Validation present in source

`poshanai-backend/src/config/env.js` checks the Mongo URI and JWT secrets, production Redis requirement, remote Mongo TLS, proxy-hop range, storage mode, S3 bucket/region, S3 credential pairing, JWT secret length/distinctness, and OTP bounds. Production also rejects JWT placeholders. Some optional numeric/config values (including port, retention days, and key lengths for encryption/signing) are not comprehensively validated; verify them in deployment review before rollout.

## Startup and health checks

- Backend startup connects to MongoDB before listening. A Mongo connection failure causes process startup to exit; Compose waits for Mongo's health check before starting API and workers.
- Production Compose waits for Redis health before API/worker startup. Redis is required for distributed rate limits and background queues in production.
- `GET /health/live` reports process liveness independent of Mongo/Redis. `GET /health/ready` checks required dependencies; `/health` remains its compatibility alias. Production readiness is unhealthy if MongoDB or Redis is unavailable. A local Redis outage can report degraded readiness.
- Compose production currently probes `/health`; keep it pointed at readiness so a dependency outage removes the API from service. Ensure orchestration liveness uses `/health/live` to avoid restarting a healthy process during a dependency outage.
- Worker and API are separate containers. Verify OCR/meal-plan queue processing and worker restart behavior in staging; an HTTP health result alone does not prove queue consumption.

## Storage, backup, and recovery

### Report storage

- Local mode stores encrypted report files under `poshanai-backend/uploads`; development Compose bind-mounts that directory. Back up and restrict it if local storage is used outside development.
- Production default S3 mode stores reports in the configured bucket and uses server-side encryption. Keep the bucket private, enable provider-side versioning/retention only after a privacy review, restrict IAM to the application’s required object operations, and test object recovery without public URLs.
- Do not rely on the `report_uploads` named volume unless local storage mode is intentionally configured. Confirm all API/worker replicas share the same local volume if local mode is used.

### MongoDB backup and restore procedure (operator runbook)

No automated backup job or restore drill was verified in the repository. Before a beta with user data:

1. Configure scheduled, encrypted backups using the managed MongoDB provider or a secured operator host. Use a dedicated least-privilege backup account.
2. Record retention, encryption-key ownership, access controls, and recovery-point objective in the deployment runbook.
3. Take a backup before every release that changes persisted schemas or operational configuration.
4. Validate restores into a separate, isolated database before relying on a backup. Never run restore commands against production as a test.
5. Verify the restored collections and indexes and only then plan a controlled cutover.

Example operator commands (placeholders only; do not run against production as written):

```powershell
# Create a compressed archive in a protected backup location.
mongodump --uri="$env:MONGODB_BACKUP_URI" --archive="D:\secure-backups\poshanai.archive.gz" --gzip

# Restore into a separate validation database; do not use --drop on the source database.
mongorestore --uri="$env:MONGODB_RESTORE_URI" --archive="D:\secure-backups\poshanai.archive.gz" --gzip --nsFrom="poshanai.*" --nsTo="poshanai_restore_validation.*"
```

The connection variables above should be provided by a secret manager or protected shell environment and must not be printed. Keep backup files outside the repository and restrict their ACLs because they contain personal data.

### Release rollback

1. Keep the prior API/worker/web image digests and matching environment configuration available for each release.
2. If post-deploy smoke checks fail, stop rollout and route traffic back to the prior known-good image set.
3. Keep MongoDB and report-storage backups independent of application images. Do not assume reverting code reverses data changes.
4. No automatic destructive migration was found in this review, but review all release-specific schema/data changes and worker job payload compatibility before rollback.
5. Re-check readiness, login, protected resource ownership, report retrieval, queue processing, and error logs after rollback. Preserve failed-release logs without retaining secrets or report contents.

## Deployment gates and remaining blockers

- A dedicated staging configuration and recorded staging smoke test do not exist in the checked-in repository.
- Verify CORS origin and proxy-hop configuration with the actual ingress chain.
- Decide and test production report storage: current Compose volume and example S3 mode are not aligned.
- Configure and test managed MongoDB backup/restore, Redis authentication/TLS and persistence, report object retention, email/OTP delivery if enabled, and OmniRoute connectivity if used.
- Run authenticated browser acceptance against synthetic users and reports before beta. Sprint 5 browser testing was blocked because no app services were running; none should be considered passed.
- Run a staging rollout and rollback drill. No production readiness or live infrastructure change is claimed here.

## Sources inspected

- `.env.example`, `.env.production.example`, `poshanai-backend/.env.example`
- `docker-compose.yml`, `docker-compose.prod.yml`
- `poshanai-backend/Dockerfile`, `poshanai-frontend/Dockerfile`, `nginx/nginx.conf`
- `poshanai-backend/src/config/env.js`, `src/config/db.js`, `src/services/storageService.js`, `src/server.js`, `src/services/healthService.js`, `src/jobs/queue.js`
- `poshanai-frontend/src/api/client.js`, `poshanai-frontend/vite.config.js`
- Sprint 5 workstream reports under `docs/implementation/`
