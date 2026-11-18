# Visitor privacy: evidence and proposed operations policy

Observed November 18, 2026. Scope is Rikskollen's application and delivery chain, not a declaration of legal compliance or total anonymity.

## Verified baseline, read-only

- Delivery: Cloudflare → cloudflared/Caddy on dm02 → WireGuard → web/API on dm01. The Rikskollen Caddy site stanza has no access-log directive and forwards proxy headers. An additional `caddy adapt` inspection found no global logging override or HTTP-server access-log configuration. Cloudflare account settings remain unverified.
- dm01 API/web logs use Docker `json-file`, `max-size=10m`, `max-file=3` per container. This is a size limit, **not a maximum number of days**. Container recreation/log removal is not a verified time-retention policy.
- dm02 shared Caddy/cloudflared containers use Docker `json-file` without explicit rotation options. Their finite time retention is unverified. Do not change these shared containers incidentally in a Rikskollen rollout.
- dm01 Docker log storage directory is root-owned mode 710; root and Docker-privileged accounts can access service logs. The Docker group contains `deploy`. This is not evidence that only Lars can access every layer; privileged accounts, SSH access and Cloudflare account membership still require owner review.
- Current production Fastify logs routine requests. Field-name-only inspection confirmed `req` in its records; source inspection confirms default request serialization. Search URLs and connection metadata can therefore enter application diagnostics. No visitor values were copied into public evidence.
- No application cookies, browser identifiers or analytics integration were found. This does not establish Cloudflare's cookie behavior. [Cloudflare documents product-dependent security cookies](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/).

## Prepared application change

Disable routine Fastify request logs. Allowlist request serialization to method only; serialize errors to a generic type instead of copying exception messages, stack traces, URLs, headers, remote addresses or SQL payloads. Keep explicit operational event messages and request correlation IDs for diagnostics. Correlation IDs are not persistent browser identities. This change applies after deployment; previously recorded logs are not retroactively changed.

The Express SSR server has no routine access logger. Framework/unhandled server errors and shared proxy/tunnel diagnostics still need review; do not claim no technical data can ever be logged through the complete chain.

## Proposed policy for owner review (not enacted)

Purpose: deliver the service and diagnose failures/security incidents, without profiling reading interests or recording search terms.

1. Do not enable routine per-visitor request logging on the app or Rikskollen proxy. Do not add visitor identifiers, cookies or raw-query analytics. Keep application errors generic and review new logging changes against this rule.
2. Restrict infrastructure and Cloudflare access to the operator and explicitly authorized administrators, with individual credentials and least privilege. Review root/deploy/SSH and Cloudflare membership; do not promise sole-person access before that audit.
3. Target a **seven-day maximum** for necessary diagnostic records. Actual dm01 retention is presently size-based and shared dm02/Cloudflare retention is not verified. Prepare a reviewed per-service retention mechanism or provider configuration before publishing seven days as an enforced promise. A size cap alone does not satisfy the target. Retaining an identified security incident beyond this target requires a documented purpose, restricted access and a deletion date.
4. Keep diagnostics out of application/database backups unless explicitly required and covered by a separately documented retention policy. Inspect backup contents/configuration before claiming this is enforced across host backups.
5. Before analytics: evaluate actual Plausible/Umami configuration, collected fields, retention, public aggregate access and URL/search suppression. No analytics is introduced by these three correction slices.

## Account-level evidence still needed before privacy acceptance

Cloudflare zone products/security cookie settings; HTTP/security/analytics log fields and retention; Logpush/export destinations; account roles; regional processing settings and applicable provider terms. Shared tunnel/error diagnostics also need operational review. No connected Cloudflare account API was available in this session; no credentials were searched for or published.

Record the approved policy separately from observed enforcement. `/om` describes bounded facts and retains the unverified-chain caveat. Release privacy acceptance remains BLOCKED pending the account/retention review, even when implementation CI passes.

### Operator observation during review

The operator reported more Cloudflare logging/analytics than anticipated. Treat that as a reason to inventory the actual zone/account products, not as evidence of particular retention durations or fields. Built-in provider traffic/security analytics are separate from an application-installed analytics script and from the planned public aggregate dashboard. Before release, document each enabled feature, purpose, fields, retention/export and permitted viewers; propose disabling optional visitor analytics while preserving necessary security protections. Do not claim dashboard settings erase provider-held records or disable security collection without verification. No Cloudflare change was made.

## Public-facing Cloudflare findings — November 18

The operator supplied screenshots while inspecting the authenticated dashboard without changes. This summary excludes personal account information, credential inventories and infrastructure-access details.

- The dashboard provides aggregate traffic/visitor statistics and individual HTTP request rows with timestamps, method, requested path and status. Its client-field list includes source IP and client information; field availability does not prove every field is populated.
- Seven- and thirty-day queries succeeded with historical chart data. This does not establish individual-event availability throughout the period or deletion afterward.
- Rikskollen is absent from the complete optional Web Analytics site list. Optional browser analytics and built-in edge analytics are separate.
- Adding datasets opens paid Log Explorer activation. No service was activated. Logpush shows a subscription screen and OpenTelemetry reports no configured destinations; this is not an exhaustive audit of every possible export method.
- Access is not represented as limited to a single dashboard login: authorized accounts and API permissions can provide access. Specific account/token details are intentionally excluded from this public document.

[Cloudflare dataset documentation](https://developers.cloudflare.com/observability/logs/datasets/) distinguishes opt-in full Log Explorer storage from built-in sampled `httpRequestsAdaptive`, available on all plans without enablement and documented as retained for **at least 31 days**. The [October 2 analytics change](https://developers.cloudflare.com/changelog/post/2026-10-02-30-days-analytics-on-every-plan/) documents up to 30 days per query. These are provider statements, not a verified deletion deadline for this zone or all provider records. The observed view strongly fits the built-in sampled dataset; the dashboard did not expose its technical identifier.

[Log Explorer controls](https://developers.cloudflare.com/observability/logs/log-explorer/manage-datasets/) and [legacy Logpull retention controls](https://developers.cloudflare.com/logs/logpull/enabling-log-retention/) concern their respective optional services. They do not establish a switch for built-in sampled analytics. No such switch was found during the walkthrough; impossibility has not been established. No Cloudflare setting or credential was changed.

The operator agreed to disclosure if built-in collection cannot be disabled. This remains conditional acceptance, not a waiver of the unresolved disable question. `/om` discloses observed processing and avoids anonymity/seven-day deletion promises across the delivery chain. The remaining decision is whether residual provider processing is acceptable once its available controls are clarified, alongside the previously proposed host diagnostic policy.

Next: ask Cloudflare whether built-in `httpRequestsAdaptive` collection/retention can be disabled or reduced for a Free zone while preserving proxy/tunnel delivery. No support message has been sent; no logs or credentials are needed for that question.
