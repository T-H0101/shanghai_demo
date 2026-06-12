# Sprint R.19 Database Patch

Apply the Site Agent runtime schema to the central PostgreSQL database:

```bash
docker exec -i unified_disc_postgres \
  psql -U unified -d unified_disc_platform \
  < databases/sprint-r19/site-agent-runtime.sql
```

The patch stores heartbeat runtime metadata and replay-protection nonces only.
It does not store database URLs, passwords, secret values, or site business data.
