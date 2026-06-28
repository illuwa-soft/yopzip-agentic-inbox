# mail.yopzip.com Cloudflare 호스팅 해피패스

이 문서는 `illuwa-soft/yopzip-agentic-inbox`를 Cloudflare Worker로 배포하고 `https://mail.yopzip.com`에서 Agentic Inbox를 쓰기 위한 운영 가이드다.

## 목표

- 앱 UI/API/MCP: `https://mail.yopzip.com`
- 수신 메일 도메인: `@yopzip.com`
- 런타임: Cloudflare Workers + Durable Objects(SQLite) + R2 + Workers AI + Email Service
- 보안 경계: Cloudflare Access 정책을 통과한 사용자만 앱/MCP 접근 가능

## 현재 저장소 기준

- 배포 명령: `npm run deploy` (`react-router build && wrangler deploy`)
- Worker 엔트리: `workers/app.ts`
- Wrangler 설정: `wrangler.jsonc`
- R2 버킷: `agentic-inbox`
- 발송 바인딩: `send_email` binding 이름 `EMAIL`
- 필수 production secret: `POLICY_AUD`, `TEAM_DOMAIN`
- `EMAIL_ADDRESSES`가 비어 있으면 UI에서 생성한 모든 `@yopzip.com` 메일박스를 허용한다. 특정 주소만 허용하려면 배열로 제한한다.

## 선행 조건

1. `yopzip.com`이 Cloudflare DNS zone으로 활성화되어 있어야 한다.
2. Cloudflare 계정에서 Workers, Durable Objects, R2, Workers AI를 사용할 수 있어야 한다.
3. Email Sending은 Cloudflare Workers Paid plan 요구사항을 확인한다.
4. 로컬/CI에 Cloudflare API Token을 준비한다.
   - 최소 권장 권한: Worker 배포, R2 관리, Zone Read, Workers Routes/Edit 또는 Custom Domains 설정에 필요한 권한.
   - 토큰 값은 문서/로그/PR에 출력하지 않는다.

## 1. Cloudflare 로그인 확인

```bash
npx wrangler whoami
```

로그인이 필요하면:

```bash
npx wrangler login
```

CI/GitHub Actions를 쓸 때는 `CLOUDFLARE_API_TOKEN`, 필요 시 `CLOUDFLARE_ACCOUNT_ID`를 GitHub Secrets에 넣는다.

## 2. 설정 확인

`wrangler.jsonc`의 핵심값:

```jsonc
{
  "name": "agentic-inbox",
  "vars": {
    "DOMAINS": "yopzip.com",
    "EMAIL_ADDRESSES": []
  },
  "routes": [
    { "pattern": "mail.yopzip.com", "custom_domain": true }
  ],
  "send_email": [
    { "name": "EMAIL", "remote": true }
  ]
}
```

Cloudflare Worker Custom Domain은 같은 zone 안의 hostname에 Worker를 직접 붙인다. `mail.yopzip.com`에 기존 `A`/`AAAA`/`CNAME` 레코드가 있으면 Custom Domain 생성이 실패할 수 있으니 먼저 충돌 레코드를 제거한다.

## 3. R2 버킷 생성

이미 있으면 생략한다.

```bash
npx wrangler r2 bucket create agentic-inbox
```

## 4. 빌드/타입체크

```bash
npm ci
npm run typecheck
npm run build
```

## 5. Worker 배포

```bash
npm run deploy
```

성공하면 Wrangler가 Worker 업로드와 route/custom domain 연결 결과를 출력한다.

## 6. Cloudflare Access 켜기

앱은 production에서 Access가 없으면 fail-closed 한다.

1. Cloudflare Dashboard → **Workers & Pages** → `agentic-inbox` 선택
2. **Settings** → **Domains & Routes**
3. `mail.yopzip.com` 또는 Worker에 대해 **Cloudflare Access** one-click 설정
4. 모달에 표시되는 값을 기록한다.
   - `POLICY_AUD`
   - `TEAM_DOMAIN` (`https://<team>.cloudflareaccess.com` 또는 `/cdn-cgi/access/certs` 전체 URL)
5. Worker secret으로 저장한다.

```bash
npx wrangler secret put POLICY_AUD
npx wrangler secret put TEAM_DOMAIN
```

secret 변경 후 재배포가 필요하면:

```bash
npm run deploy
```

## 7. Email Routing: 수신 메일을 Worker로 보내기

Cloudflare 공식 흐름 기준:

1. Dashboard → **Compute** → **Email Service** → **Email Routing**
2. `yopzip.com` 온보딩
   - Cloudflare가 MX/SPF/DKIM 레코드를 추가한다.
   - DNS 전파는 보통 5~15분, 최대 24시간으로 본다.
3. **Routing Rules**에서 catch-all 또는 특정 주소 rule 생성
   - Happy path: **Catch-all rule** 활성화
   - Action: **Send to a Worker**
   - Worker: `agentic-inbox`
4. 처음에는 테스트 주소 하나만 만들고 성공 후 catch-all로 넓혀도 된다.

주의: catch-all Action이 `Drop`이면 Cloudflare가 메일을 받지만 앱에는 들어오지 않는다. 반드시 `Send to a Worker`인지 확인한다.

## 8. Email Sending: 앱에서 답장/신규 발송 허용

1. Dashboard → **Compute** → **Email Service** → **Email Sending**
2. `yopzip.com` 온보딩
   - `cf-bounce.yopzip.com` 관련 MX/SPF/DKIM
   - `_dmarc.yopzip.com` DMARC
3. `wrangler.jsonc`에는 이미 `send_email` binding `EMAIL`이 있다.
4. 발신 주소는 앱에서 만든 mailbox와 같은 도메인 주소를 우선 사용한다.

## 9. 첫 메일박스 생성

1. `https://mail.yopzip.com` 접속
2. Cloudflare Access 로그인 통과
3. 예: `hello@yopzip.com` 메일박스 생성
4. 외부 Gmail/개인 계정에서 `hello@yopzip.com`으로 테스트 메일 발송
5. 앱 Inbox에 수신되는지 확인
6. 앱에서 외부 계정으로 답장을 보내고 수신되는지 확인

## 10. 검증 명령

DNS:

```bash
dig +short MX yopzip.com
dig +short TXT yopzip.com
dig +short TXT _dmarc.yopzip.com
dig +short mail.yopzip.com
```

HTTP/Access 경계:

```bash
curl -I https://mail.yopzip.com
```

예상:
- Access 미로그인 브라우저는 Cloudflare Access 로그인으로 유도된다.
- Access 통과 후 앱 UI가 열린다.
- `POLICY_AUD`/`TEAM_DOMAIN`이 틀리면 `Invalid or expired Access token`이 보일 수 있다.

Worker 로그:

```bash
npx wrangler tail agentic-inbox
```

수신 메일 테스트 중 `Ignoring email for ...: mailbox does not exist`가 보이면 앱에서 해당 주소 mailbox를 먼저 생성한다.

## 11. 롤백

- 앱 공개 중단: Worker → Settings → Domains & Routes에서 `mail.yopzip.com` Custom Domain 제거 또는 `wrangler.jsonc` route 제거 후 재배포.
- 메일 수신 롤백: Email Routing rule을 disable하거나 이전 MX provider의 MX 레코드로 되돌린다.
- 발송 중단: Email Sending domain/binding을 비활성화하거나 Worker에서 `send_email` binding 제거 후 재배포.
- Access 문제: Access 앱을 끄기보다는 `POLICY_AUD`/`TEAM_DOMAIN` secret을 최신 modal 값으로 다시 넣는다. Access를 끄면 production 앱은 의도적으로 fail-closed 한다.

## 해피패스 진행 로그

| 단계 | 상태 | 증거/메모 |
| --- | --- | --- |
| 저장소 clone 및 설정 확인 | done | `wrangler.jsonc`, `README.md`, `package.json` 확인 |
| Cloudflare 최신 문서 확인 | done | Workers Custom Domains, Email Routing, Email Sending docs 확인 |
| `mail.yopzip.com` route 설정 | done | `wrangler.jsonc`에 `{ "pattern": "mail.yopzip.com", "custom_domain": true }` 추가 |
| `DOMAINS=yopzip.com` 설정 | done | `wrangler.jsonc` vars 반영 |
| `npm ci` | done | 525 packages installed, audit warning 27 vulnerabilities |
| `npm run typecheck` | done | `wrangler types`, `react-router typegen`, `tsc -b` 성공 |
| `npm run build` | done | React Router client/server production build 성공 |
| `npx wrangler deploy --dry-run` | done | redirected Wrangler config, bindings(`EMAIL`, `BUCKET`, `AI`, DOs), `DOMAINS=yopzip.com` 확인 |
| R2 bucket 생성 | pending | `wrangler r2 bucket create agentic-inbox` |
| Worker deploy | pending | `npm run deploy` 출력/URL 기록 |
| Access one-click 설정 | pending | `POLICY_AUD`, `TEAM_DOMAIN` secret 저장 |
| Email Routing → Worker | pending | catch-all 또는 테스트 주소 rule |
| Email Sending 온보딩 | pending | `cf-bounce`, DKIM, DMARC DNS 확인 |
| 수신 테스트 | pending | 외부 계정 → `hello@yopzip.com` |
| 발송 테스트 | pending | 앱 → 외부 계정 |

## 참고한 공식 문서

- Cloudflare Workers Custom Domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- Cloudflare Email Service Routing: https://developers.cloudflare.com/email-service/get-started/route-emails/
- Cloudflare Email Service Sending: https://developers.cloudflare.com/email-service/get-started/send-emails/
- Cloudflare Agents email channel: https://developers.cloudflare.com/agents/communication-channels/email/
