# Caddy patch — HTTP :5050 → HTTPS :5055 redirect

This file documents the **manual server-side changes** that must be applied on the
VPS **before** (or simultaneously with) merging the `security/redirect-http-5050-to-https-5055`
branch. The app's `docker-compose.yml` no longer publishes port 5050 on the host;
Caddy takes ownership of that port to serve a permanent 301 redirect.

---

## ⚠️ Deployment order (critical)

```
1. Apply Caddy changes below  (Caddy takes port 5050)
2. Reload Caddy               (port 5050 now serves the 301)
3. Merge the PR               (GitHub Actions removes 5050 from the app)
```

Reversing steps 2 and 3 leaves port 5050 closed for ~5 min while the new app
image builds — existing users get a connection-refused error.

---

## 1. Edit the Caddyfile

File: `/opt/trystbrief/Caddyfile`

Add this block **before or after** the existing `sellingmyitems.toprecipes.best:5055` entry:

```caddy
http://sellingmyitems.toprecipes.best:5050 {
    redir https://sellingmyitems.toprecipes.best:5055{uri} permanent
}
```

Full expected result (relevant excerpt):

```caddy
sellingmyitems.toprecipes.best:5055 {
    reverse_proxy sellingmyitems-app:3000
    encode gzip
}

http://sellingmyitems.toprecipes.best:5050 {
    redir https://sellingmyitems.toprecipes.best:5055{uri} permanent
}
```

---

## 2. Expose port 5050 from the Caddy container

File: `/opt/trystbrief/docker-compose.yml`

Add `"5050:5050"` to the `ports:` section of the `caddy` service:

```yaml
services:
  caddy:
    # ...
    ports:
      - "80:80"
      - "443:443"
      - "5050:5050"   # ← add this line
      - "5055:5055"
      # ... other ports
```

---

## 3. Apply the changes

```bash
ssh vultr  # or: ssh -i ~/.ssh/id_ed25519_vultr_r45635 r45635@45.32.220.152

cd /opt/trystbrief

# Edit files as above, then:

# Reload Caddy config without downtime
docker exec caddy caddy reload --config /etc/caddy/Caddyfile

# If reload fails (e.g. new port requires container restart):
echo '+gnE/->...' | sudo -S docker compose up -d caddy
```

---

## 4. Verify firewall

```bash
echo '+gnE/->...' | sudo -S ufw status
# Should list:  5050/tcp   ALLOW
# If missing:
echo '+gnE/->...' | sudo -S ufw allow 5050/tcp
echo '+gnE/->...' | sudo -S ufw reload
```

---

## 5. Validation after full deploy

```bash
# Must return: HTTP/1.1 301 Moved Permanently  +  Location: https://...:5055/
curl -sI http://sellingmyitems.toprecipes.best:5050/

# Must return: 200 or 307 (i18n redirect is normal)
curl -skI https://sellingmyitems.toprecipes.best:5055/

# App container must no longer publish 5050 on host:
docker ps --filter name=sellingmyitems-app --format '{{.Ports}}'
# Expected: empty or only internal — no "0.0.0.0:5050->3000"
```

---

## 6. Rollback plan

If the redirect breaks something in production:

```bash
# 1. Revert Caddy — remove the http://...:5050 block from Caddyfile
# 2. Remove "5050:5050" from Caddy docker-compose.yml
# 3. Reload Caddy
docker exec caddy caddy reload --config /etc/caddy/Caddyfile

# 4. On the app side — temporarily re-expose 5050:
cd /root/sellingmyitems
# Edit docker-compose.yml: restore  ports: ["5050:3000"]  under app service
docker compose up -d --force-recreate app

# 5. Revert the PR on GitHub (git revert) and let GitHub Actions redeploy
```
