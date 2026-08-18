# 데이터 계약 (hospitals.json / meta.json / holidays.json / overrides)

배포 URL: `https://dongil618.github.io/pet_er_map/{hospitals,meta,holidays}.json`
생성: `scripts/pipeline.py` (GitHub Actions 매일 03:15 KST). 앱은 이 파일들만 읽는다(백엔드 없음).

## 1. hospitals.json — `Hospital[]`

| 필드 | 타입 | 출처 | 설명 |
|---|---|---|---|
| `id` | string | 공공 `MNG_NO` | 관리번호(자연키) |
| `name` | string | `BPLC_NM` | 병원명 |
| `lat`, `lng` | number | `CRD_INFO_Y/X` → WGS84 | 소수 7자리, EPSG:5174 변환 |
| `address` | string | road ?? lot | 표시용 |
| `roadAddress`, `lotAddress` | string | | |
| `sido`, `sigungu` | string | 주소 파싱 | 지역 검색·Phase 판단용 |
| `phone` | string | `TELNO` 정규화 | 대표번호. `0N-NNN(N)-NNNN` 형식, 없으면 "" |
| `phones` | `Phone[]?` | overrides | `{type: main\|night\|emergency, phone, verifiedAt?}` |
| `statusCode`, `status` | string | `SALS_STTS_CD/NM` | 영업만 수집(`01`) |
| `permitDate`, `closedDate` | string? | | ISO 날짜 |
| `sourceUpdatedAt` | string? | `LAST_MDFCN_PNT` | ISO(+09:00) |
| `localGovernmentCode` | string | `OPN_ATMY_GRP_CD` | |
| `source` | string | 상수 | "행정안전부_동물_동물병원 조회서비스" |
| `verified` | `Verified?` | overrides | **없으면 null → 상태 UNKNOWN** |
| `realtime` | `Realtime?` | (P2) | `{status: accepting\|halted, updatedAt}` — 3시간 TTL |

### Verified
| 필드 | 타입 | 설명 |
|---|---|---|
| `sourceType` | enum | `hospitalVerified` > `officialWebsite` > `phoneCall` > `publicData` > `userReports` > `mapApi` > `userReport` (충돌 시 우선순위, PRD §10) |
| `sourceUrl` | string? | |
| `verifiedAt` | string | ISO(+09:00). Freshness 계산 기준 |
| `verifiedBy` | string | 관리자 식별자 |
| `confidenceScore` | int 0~100 | PRD §11. overrides 에 없으면 sourceType+경과일로 파이프라인이 계산 |
| `is24hGeneral`, `is24hEmergency`, `nightEmergency`, `holidayOpen` | bool | 요약 플래그(PRD §34 Risk 2). `hours` 로부터 파생 가능하지만 명시값이 우선 |
| `hours` | `WeeklyHours[]` | 요일별. 없으면 UNKNOWN |
| `specialHours` | `SpecialHours[]` | 날짜별(공휴일·임시휴진). 요일 스케줄보다 우선 |
| `species` | string[] | `dog cat rabbit hamster guineaPig ferret bird reptile otherExotic` |
| `facilities` | string[] | `surgery hospitalization icu oxygen xray ultrasound ct mri endoscopy bloodTest transfusion dialysis` |
| `notes` | string? | 표시용 메모(예: "야간은 예약 전화 필수") |

### WeeklyHours — 시간은 **해당 요일 00:00 기준 분(minute) 정수, 0~2880**
```
{ "day": 1..7 (ISO, 1=월 … 7=일),
  "open": 540, "close": 1140,                // 일반 09:00~19:00, 없으면 null
  "nightOpen": 1140, "nightClose": 1440,     // 야간
  "emergencyOpen": 1140, "emergencyClose": 1980,   // 응급 19:00~익일 09:00 (1980 = 24h+9h)
  "isClosed": false,                         // 정기휴무
  "breakStart": null, "breakEnd": null }
```
- `close < open` 형태 저장 금지. 자정을 넘기면 1440 을 더한다.
- 24시간 = `open: 0, close: 1440` (또는 플래그 `is24hGeneral/is24hEmergency`).
- 상태 계산 시 **전날 요일의 >1440 구간**도 함께 평가한다.

### SpecialHours
```
{ "date": "2026-09-25", "isClosed": true, "reason": "추석",
  "open": null, "close": null, "emergencyOpen": 0, "emergencyClose": 1440 }
```
`isClosed: true` 여도 `emergencyOpen/Close` 가 있으면 그 구간은 EMERGENCY_ONLY.

## 2. meta.json
```
{ "schemaVersion": 1, "source": "...", "sourceUrl": "https://apis.data.go.kr/1741000/animal_hospitals/info",
  "generatedAt": "2026-08-18T00:00:00Z", "sourceUpdatedAt": "...", "totalCount": 5000,
  "verifiedCount": 12, "contentHash": "sha256", "coordinateSystem": "WGS84 (converted from EPSG:5174)" }
```
`contentHash` 가 같으면 파일을 다시 쓰지 않는다(커밋 churn 방지). 앱은 `contentHash` 를 ETag 대용으로 캐시 키에 쓴다.

## 3. holidays.json
```
{ "updatedAt": "...", "source": "공공데이터포털 특일정보 | fallback:data/holidays.yaml",
  "holidays": [ {"date": "2026-01-01", "name": "신정"}, ... ] }
```
`SPECIAL_DAY_SERVICE_KEY` 가 있으면 API, 없으면 `data/holidays.yaml` 을 그대로 내보낸다.

## 4. overrides (git-as-CMS) — `data/overrides/<id>.yaml`
```yaml
id: "3000000-2020-00001"      # hospitals.json 의 id 와 일치해야 적용
name: "24시 OO동물의료센터"     # 검증용 표기(불일치 시 경고만)
phones:
  - { type: main, phone: "02-000-0000" }
  - { type: emergency, phone: "010-0000-0000" }
verified:
  sourceType: phoneCall
  sourceUrl: "https://..."
  verifiedAt: "2026-08-10T15:00:00+09:00"
  verifiedBy: admin
  is24hEmergency: true
  hours:
    - { day: 1, open: 540, close: 1140, emergencyOpen: 1140, emergencyClose: 1980 }
    - ... (7 요일; 생략 요일은 isClosed 로 간주하지 않고 "정보 없음")
  specialHours: []
  species: [dog, cat]
  facilities: [surgery, hospitalization, xray, ultrasound]
  notes: ""
```
- 파이프라인은 `verified.confidenceScore` 가 없으면 계산: base(sourceType) − 경과일 감점. base: hospitalVerified 95 · officialWebsite 85 · phoneCall 80 · publicData 30 · userReports 55 · mapApi 40 · userReport 35. 감점: 31~90일 −15, 91일 초과 −30(하한 0~29 구간 유지).
- id 가 공공데이터에 없으면 (폐업 등) 경고 후 무시.

## 5. 품질검사 (PRD §18) — 파이프라인 실패 조건
- 국내 범위(33~39N, 124~132E) 밖 좌표 → 레코드 제외 + 카운트 로그
- 병원명/주소 NULL → 제외
- 전화번호 형식 오류 → `phone: ""` (제외 아님)
- 영업 중인데 폐업일 존재 → 경고
- 중복 병원 후보(이름 유사 + 100m 이내) → 경고 로그(자동 병합 안 함)
- 전체 건수 < max(1000, 이전 80%) → **배포 중단**
