# Kubernetes runbook

How to run Mushpoint on a local [kind](https://kind.sigs.k8s.io/) cluster with the manifests in
[`deploy/k8s/`](../deploy/k8s), and how to operate it: roll out, roll back, scale, rotate secrets,
tear down. The database, auth and image storage stay on Supabase; nothing stateful runs in the cluster.

> **Status:** the manifests are written and checked offline (they parse, and every Secret,
> ConfigMap and Service reference resolves). Both images were run with the same read-only root
> filesystem, probes and SIGTERM handling the manifests use. The full kind walkthrough below has
> not been run end to end yet; record the result in [Verification log](#verification-log) when it is.

> **Decision needed: the ingress controller.** The plan pinned ingress-nginx, and the manifests use
> its annotations (rate limit, body size). The Kubernetes project retired ingress-nginx in March
> 2026, so it gets no more fixes. That is fine for a local learning cluster; before a real
> deployment, move to a maintained controller (for example a Gateway API implementation) and port
> the two annotations.

## What each manifest does

| File | What it is |
| --- | --- |
| `namespace.yaml` | Everything lives in the `mushpoint` namespace. |
| `configmap-api.yaml` | Non-secret API settings: `PORT`, `TRUST_PROXY=1` (the ingress is one hop), `LOG_LEVEL`, `SUPABASE_URL`. |
| `configmap-web.yaml` | The SPA's `config.json` (API path, Supabase URL, publishable key). All public. |
| `../secret.example.yaml` | Shape of the `api-secrets` Secret. Kept outside `k8s/` so `kubectl apply -f deploy/k8s` never applies placeholders. |
| `migrate-job.yaml` | Runs `node dist/db/migrateCli.js` from the API image as the database owner. Migrations only add, and applied ones are skipped. |
| `api-deployment.yaml` | 2 API pods. Liveness `GET /api/healthz` (process up), readiness `GET /api/readyz` (database reachable). Rolling update with no unavailable pods; a 5 s `preStop` sleep, then the API drains for up to 20 s inside a 30 s grace period. Non-root, read-only root filesystem, all capabilities dropped. |
| `api-service.yaml`, `web-service.yaml` | Cluster-internal port 80 to each Deployment's `http` port. |
| `web-deployment.yaml` | 2 nginx pods serving the static build. `config.json` is mounted from `web-config`, so one image serves every environment. Same hardening as the API; `/tmp` is the only writable path. |
| `ingress.yaml` | One origin, so no CORS: `/api` to the API, `/` to the SPA. 20 requests/s per client IP (burst 5x) in front of the API's own 600/min limit, and a 6 MB body limit for the 5 MB image uploads (the controller default is 1 MB). |
| `../kind-config.yaml` | One-node cluster with host port 8080 mapped to the ingress. |

## Prerequisites

Docker, [kind](https://kind.sigs.k8s.io/docs/user/quick-start/#installation) and kubectl. A
Supabase project with migrations applicable to its Postgres (see the root README).

## Bring it up

Run from the repo root.

```sh
# 1. Cluster and ingress controller
kind create cluster --config deploy/kind-config.yaml
kubectl apply -f https://kind.sigs.k8s.io/examples/ingress/deploy-ingress-nginx.yaml
kubectl -n ingress-nginx wait --for=condition=ready pod -l app.kubernetes.io/component=controller --timeout=180s

# 2. Images: build locally and copy them into the kind node (no registry needed)
docker build -t mushpoint-api:local server
docker build -t mushpoint-web:local app
kind load docker-image mushpoint-api:local mushpoint-web:local --name mushpoint

# 3. Namespace, config and secrets
kubectl apply -f deploy/k8s/namespace.yaml
# Edit SUPABASE_URL in configmap-api.yaml and config.json in configmap-web.yaml first.
kubectl apply -f deploy/k8s/configmap-api.yaml -f deploy/k8s/configmap-web.yaml
# deploy/api-secrets.env is gitignored; one KEY=value per line, keys as in secret.example.yaml.
kubectl -n mushpoint create secret generic api-secrets --from-env-file=deploy/api-secrets.env

# 4. Migrate, then start everything else
kubectl apply -f deploy/k8s/migrate-job.yaml
kubectl -n mushpoint wait --for=condition=complete job/migrate --timeout=120s
kubectl apply -f deploy/k8s
kubectl -n mushpoint rollout status deploy/api deploy/web
```

Open `http://localhost:8080`. Add `http://localhost:8080/auth/callback` to the Supabase project's
redirect URLs first, or email links will not come back to the cluster.

## Day-to-day operations

```sh
kubectl -n mushpoint get pods,svc,ingress
kubectl -n mushpoint logs deploy/api -f          # JSON lines; never contain tokens or query strings
kubectl -n mushpoint logs job/migrate
kubectl -n mushpoint scale deploy/api --replicas=3
```

### Roll out a new version

```sh
docker build -t mushpoint-api:v2 server
kind load docker-image mushpoint-api:v2 --name mushpoint
# If the release adds a migration, run the Job with the new image first. A Job's
# pod template cannot change after creation, so set the image in the file:
# image: mushpoint-api:v2 in deploy/k8s/migrate-job.yaml, then
kubectl -n mushpoint delete job migrate --ignore-not-found
kubectl apply -f deploy/k8s/migrate-job.yaml
kubectl -n mushpoint wait --for=condition=complete job/migrate --timeout=120s
kubectl -n mushpoint set image deploy/api api=mushpoint-api:v2
kubectl -n mushpoint rollout status deploy/api
```

The web image works the same way with `deploy/web` and container `web`.

### Roll back

```sh
kubectl -n mushpoint rollout history deploy/api
kubectl -n mushpoint rollout undo deploy/api            # previous revision
kubectl -n mushpoint rollout undo deploy/api --to-revision=3
```

Migrations only add columns and tables, so the previous API keeps working on the newer schema.
There is no down-migration; a bad migration is fixed with a new one.

### Change runtime config

```sh
kubectl apply -f deploy/k8s/configmap-web.yaml
# config.json is a subPath mount, which does not follow ConfigMap edits:
kubectl -n mushpoint rollout restart deploy/web
# API settings are read at start-up:
kubectl apply -f deploy/k8s/configmap-api.yaml && kubectl -n mushpoint rollout restart deploy/api
```

### Rotate `SUPABASE_SERVICE_KEY`

1. In the Supabase dashboard, create a new secret key (keep the old one active).
2. Update `deploy/api-secrets.env`, then replace the Secret and restart the API:

   ```sh
   kubectl -n mushpoint create secret generic api-secrets --from-env-file=deploy/api-secrets.env \
     --dry-run=client -o yaml | kubectl apply -f -
   kubectl -n mushpoint rollout restart deploy/api
   kubectl -n mushpoint rollout status deploy/api
   ```

3. Check an image upload and an account deletion work, then revoke the old key in Supabase.

The database passwords rotate the same way: change the password in Postgres, update the env file,
replace the Secret, restart.

### See the probes work

```sh
# Readiness: point the API at a dead database; pods go NotReady and leave the Service,
# liveness stays green so they are not restarted.
kubectl -n mushpoint set env deploy/api DATABASE_URL=postgres://x:y@127.0.0.1:1/none
kubectl -n mushpoint get pods -w
kubectl -n mushpoint rollout undo deploy/api

# Self-healing: delete a pod mid-use; the page keeps working on the other replica.
kubectl -n mushpoint delete "$(kubectl -n mushpoint get pod -l app=api -o name | head -1)"
```

## Tear down

```sh
kind delete cluster --name mushpoint
```

## Incidents

| Symptom | First check |
| --- | --- |
| Every page shows "service unavailable" | `kubectl -n mushpoint get pods`: API pods NotReady means `/api/readyz` cannot reach Postgres. Check Supabase status and `DATABASE_URL`. |
| Sign-in works, every API call is 401 | `SUPABASE_URL` in `api-config` does not match the project in `config.json`. |
| Image uploads fail with 413 | The ingress body limit (`proxy-body-size`) is below the upload size. |
| Bursts of 429 | The ingress limit (20/s per IP) or the API limit (600/min per IP). Behind another proxy, `TRUST_PROXY` must count every hop. |
| Pods restart in a loop | `kubectl -n mushpoint logs <pod> --previous`. A missing required env var stops the API at start-up with its name. |

Contacts: _owner to fill in (who is paged, Supabase account owner, where status is posted)._

## Verification log

| Date | Who | Result |
| --- | --- | --- |
| 2026-11-20 | Claude | Manifests parsed, references cross-checked. Both images run read-only with `/tmp` writable; `/api/healthz` 200, `/api/readyz` 500 without a database, SIGTERM drains and exits. kind not installed on this machine, so the cluster walkthrough is not yet run. |
