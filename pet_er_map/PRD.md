> Notion 원본: https://app.notion.com/p/3bfe8140a59a81bd8dcdfbf2574f252b · 사본 생성 2026-08-18 · 백엔드 섹션은 아래 "구현 노트" 참고

# 🐾 반려동물 응급·야간 병원 지도

**상태:** 기획 중 · **태그:** 라이프 스타일
**설명:** 현재 위치를 기준으로 지금 진료 가능한 동물병원, 야간·24시간·응급 진료 병원을 찾아 전화·길찾기까지 연결하는 반려동물 응급 의료 지도 앱.
**메모:** 최종 순위 3위 · 시장성 76점 · 경쟁 강도 중간 · 수익성 높음. 핵심은 단순 병원 지도가 아니라 '지금 실제로 갈 수 있는 병원'을 신뢰도 있게 보여주는 것. 공공데이터 기반 전국 동물병원 Master DB + 병원 홈페이지/직접 인증/사용자 제보 기반 야간·응급 운영정보를 결합. 주요 경쟁: 왈냥이(24시 응급 동물병원), 펫뷸런스(특수동물·야간진료).

> 🚨 **핵심 포지셔닝:** 단순히 동물병원 위치를 보여주는 앱이 아니라 **"지금 실제로 진료 가능한 병원"**을 가장 빠르고 신뢰도 높게 찾는 앱.

> **변경 이력 — 2026-08-18:** §28 백엔드 → 정적 JSON + Firebase 로 확정, Flutter 앱 구현 시작 (repo dongil618/pet_er_map). 상세는 §28 참고.

## 1. 제품 개요

**가칭:** 펫응급맵 / Pet ER Map
**서비스 형태:** Android/iOS 모바일 앱
**핵심 타깃:** 반려견·반려묘 및 특수동물 보호자
**핵심 가치:** 현재 위치에서 지금 갈 수 있는 야간·24시간·응급 동물병원을 빠르게 찾고 전화·길찾기까지 즉시 연결한다.

### 아이디어 평가

- 최종 순위: **3위**
- 시장성 점수: **76점**
- 경쟁 강도: **🟡 중간**
- 수익성: **높음**
- 경쟁 상황: 왈냥이는 24시 응급 동물병원을 강조하고 있고, 펫뷸런스는 특수동물·야간진료에 집중. 경쟁이 생기기 시작한 시장.

## 2. 문제 정의

반려동물이 밤이나 휴일에 갑자기 아플 때 일반 지도 앱에는 다음 문제가 있다.

- 검색 결과에 이미 진료가 끝난 병원이 포함될 수 있음
- 상호명에 `24시`가 있어도 실제 응급 외래를 24시간 받는지 알기 어려움
- 일반진료 시간과 야간 응급진료 시간이 다름
- 응급환자 접수 중단 여부를 알기 어려움
- 특정 요일만 24시간 운영하는 경우가 있음
- 특수동물은 진료 가능 병원이 제한적임
- 응급수술, 입원, CT/MRI 등 필요한 시설 정보를 한 번에 확인하기 어려움
- 운영시간 정보가 서비스마다 다를 수 있음

따라서 단순 POI 지도보다 **운영시간·응급접수 여부·마지막 검증 시각**이 핵심 데이터다.

## 3. 핵심 사용자

### Persona A — 일반 반려견 보호자

밤 11시에 강아지가 구토·출혈·골절 증상을 보여 지금 갈 수 있는 병원을 찾고 싶다.

### Persona B — 반려묘 보호자

고양이가 급성 증상을 보여 고양이 진료 및 입원이 가능한 응급병원을 찾고 싶다.

### Persona C — 특수동물 보호자

토끼·햄스터·조류·파충류 등을 진료할 수 있는 야간 병원이 필요하다.

## 4. 핵심 사용자 시나리오

1. 사용자가 앱 실행
2. 위치 권한 허용
3. 현재 위치 주변 병원 조회
4. 현재 시간 기준 진료 가능 상태 계산
5. `지금 진료 가능` 병원 우선 정렬
6. 병원 상세에서 응급 여부·진료시간·진료동물·시설 확인
7. 전화로 접수 가능 여부 확인
8. 네이버지도/카카오맵/TMAP 길찾기 실행

회원가입 없이 이 플로우를 완료할 수 있어야 한다.

### 예외 플로우

- **위치 권한 거부 / 위치 획득 실패:** 지역(시·군·구) 검색 또는 지도 이동으로 동일 플로우 진행. 권한 재요청은 1회만.
- **검증 데이터가 없는 지역(Phase 1 밖):** 공공데이터 기반 병원을 ⚪ 미확인 마커로 그대로 노출하고 카드에 "운영 여부 미확인 · 전화로 확인하세요" + 전화 CTA를 표시한다. 빈 화면을 보여주지 않는다.
- **오프라인 / 네트워크 지연:** 마지막 조회 결과를 캐시에서 표시하고 "오프라인 결과" 배지를 붙인다.

### 야간 사용 UX 원칙

- 다크모드 기본, 한 손 조작, 큰 CTA
- 첫 화면에서 **2탭 이내 전화 연결**

## 5. MVP 기능 범위

### P0 — 출시 필수

- 현재 위치 기반 동물병원 지도
- 병원 리스트 보기
- `지금 진료 가능` 필터
- 24시간 / 야간진료 / 응급진료 필터
- 일요일 / 공휴일 진료 필터
- 진료동물 필터 (강아지 / 고양이 / 특수동물 3-way) — Persona C 및 Ranking의 진료동물 일치 점수와 정합
- 병원명·지역 검색
- 병원 상세
- 전화하기
- 외부 지도 길찾기
- 운영시간 표시
- 데이터 마지막 확인 시각 표시
- 정보 오류 제보
- 관리자 병원정보 수정
- Firebase Analytics / Crashlytics
- AdMob

### P1

- 특수동물 세부 종 필터 (토끼 / 햄스터 / 조류 / 파충류 등)
- 병원 즐겨찾기
- 반려동물 프로필
- 시설 필터
- 병원 공식 인증
- 사용자 정보 정확성 평가
- 신규 야간병원 알림

### P2

- 병원 실시간 응급접수 상태
- 병원 관리자용 페이지
- 응급 대기시간
- 지역별 진료비 참고정보
- 병원 SaaS

## 6. 지도 UX

### 마커 상태

마커 색은 **현재 상태(§13 enum)** 만 표현하고, 병원 유형(24시간·야간·응급)은 카드/상세의 뱃지로 분리한다. 색각 접근성을 위해 색과 함께 아이콘 모양도 구분한다.

- 🔴 EMERGENCY_ONLY — 응급 접수만 가능 (원형+십자)
- 🟠 NIGHT_OPEN — 야간진료 중 (원형+달)
- 🟢 OPEN — 일반 진료시간 (원형)
- ⚪ UNKNOWN — 운영 여부 미확인 (점선 원형)
- ⚫ CLOSED — 현재 영업 종료 (회색 원형)

유형 뱃지: `24시간 응급` `야간진료` `공휴일 진료` `특수동물`

### 병원 카드 예시

> **24시 OO동물의료센터**
> 🟢 현재 응급접수 가능
> 1.8km · 차량 약 7분
> 병원 확인 · 19분 전 업데이트
> **전화하기 | 길찾기**

시간표만으로 계산한 경우에는 `현재 진료 가능`이라고 단정하지 않고 **"현재 진료시간입니다"**로 표현한다.

### 실시간 상태 만료(TTL) 규칙

병원이 직접 갱신한 실시간 상태(`응급접수 가능/중단`)는 **갱신 후 3시간**이 지나면 자동으로 시간표 계산 상태로 강등하고, 카드 문구도 "현재 진료시간입니다"로 바꾼다. 어제 찍힌 "접수 가능"이 계속 노출되는 일을 막기 위함이다.

## 7. 병원 상세 정보

### 기본

- 병원명
- 주소
- 거리
- 전화번호
- 현재 상태
- 일반 진료시간
- 야간 진료시간
- 응급 진료시간
- 공휴일 운영
- 마지막 확인 일시
- 정보 출처 / 신뢰도

### 진료 동물

- 강아지
- 고양이
- 토끼
- 햄스터
- 기니피그
- 페럿
- 조류 / 앵무새
- 파충류
- 기타 특수동물

### 시설

- 응급수술
- 입원실
- 중환자실
- 산소실
- X-Ray
- 초음파
- CT
- MRI
- 내시경
- 혈액검사
- 수혈
- 투석

## 8. 데이터 전략

이 앱의 핵심 자산은 코드보다 **대한민국 반려동물 야간·24시간·응급진료 병원 Verified Database**다.

### 데이터 계층

**Layer 1 — 정부 인허가 데이터**
전국 병원 Master DB 구축

**Layer 2 — 위치·전화번호 정규화 데이터**
좌표 및 기본정보 보정

**Layer 3 — 야간·응급 운영 데이터**
병원 홈페이지 / 전화 확인 / 병원 직접 등록

**Layer 4 — 실시간 운영 데이터**
병원 공식 관리자 또는 사용자 제보

## 9. 데이터 출처

### A. 공공데이터포털 — 전국동물병원표준데이터

**용도:** 전국 동물병원 Master DB

주요 활용 필드:

- 인허가번호
- 인허가일자
- 영업상태
- 폐업일자
- 사업장명
- 도로명주소
- 지번주소
- 좌표
- 데이터 기준일

출처: [공공데이터포털 전국동물병원표준데이터](https://www.data.go.kr/data/15155679/standard.do)

### B. 행정안전부 동물병원 Open API

**용도:** 신규·수정·폐업 병원 정기 동기화

앱이 직접 호출하지 않고 Backend Batch가 호출한 뒤 내부 DB에서 제공한다.

```
공공 API
  ↓
Backend Batch
  ↓
Raw Hospital
  ↓
Normalize / Deduplicate
  ↓
Hospital DB
  ↓
App API
```

출처: [공공데이터포털 동물병원 API](https://www.data.go.kr/data/15154952/openapi.do)

### C. LOCALDATA / 지방행정인허가 데이터

**용도:** 병원 신규·변경·폐업 감지

감지 이벤트:

- `NEW_HOSPITAL`
- `CLOSED_HOSPITAL`
- `ADDRESS_CHANGED`
- `NAME_CHANGED`
- `STATUS_CHANGED`

### D. 병원 공식 홈페이지 / SNS / 공지

**용도:** 공공데이터에 없는 핵심 정보 보강

수집 대상:

- 요일별 진료시간
- 야간진료
- 24시간 여부
- 응급진료
- 진료 가능 동물
- 진료과목
- 입원 가능 여부
- CT/MRI 등 의료시설

각 항목마다 반드시 다음 메타데이터를 함께 저장한다.

```
source_type
source_url
verified_at
verified_by
confidence_score
```

### A~C 공통 메모

A·B·C는 모두 **지방행정인허가(LOCALDATA) 원천이 동일**하다. 파이프라인은 하나(LOCALDATA API 기준)로 만들고, 표준데이터는 초기 적재·검증용으로만 사용한다. LOCALDATA 좌표는 EPSG:5174(TM) → WGS84(4326) 변환이 필요하다.

### E. 지도 API

**용도:** 좌표 누락·오류 보정 및 길찾기 연결

후보:

- Kakao Local API
- Naver Maps API

외부 지도 데이터의 영구 저장 및 재사용은 실제 출시 시 해당 API 이용약관을 다시 확인한다.

### F. 병원 직접 등록 / 인증

병원 관계자가 자신의 병원 운영정보를 등록·수정할 수 있게 한다.

등록 항목:

- 담당자 정보
- 대표 전화
- 진료시간
- 야간진료
- 24시간 응급 여부
- 진료동물
- 진료과목
- 보유시설
- 임시휴진

관리자 검증 후 **병원 인증 정보** 배지를 제공한다.

**인증 절차(사칭 방지):** 공공데이터의 대표번호로 콜백 인증 또는 사업자등록증 업로드 중 하나를 필수로 한다. 담당자 정보(이름·연락처)는 개인정보로 처리방침에 항목을 명시한다.

### H. 공휴일 데이터

**용도:** 일요일/공휴일 필터, `hospital_special_hours` 우선 적용, 대체공휴일 처리

출처: 공공데이터포털 한국천문연구원 특일 정보 API. 매년 초 + 매월 배치로 동기화한다.

### G. 사용자 제보

병원 상세에서 `정보가 달라요` 제공.

제보 항목:

- 폐업
- 전화번호 오류
- 진료시간 오류
- 24시간 아님
- 야간진료 안 함
- 특정 동물 진료 안 함
- 위치 오류
- 기타

동일 항목에 다수 신고가 쌓이면 관리자 검증 Queue 우선순위를 높인다.

**스팸/악의적 신고 방지:** 기기당 병원별 신고 1일 1회, 동일 IP·기기의 반복 신고는 가중치 감쇠, 병원 인증 계정의 셀프 데이터와 충돌하면 관리자 검토로만 반영한다.

## 10. 데이터 Source Priority

정보 충돌 시 우선순위:

1. 병원 직접 인증
2. 병원 공식 홈페이지 / 공식 공지
3. 병원 전화 확인
4. 정부 공공데이터
5. 다수 사용자 제보
6. 지도 API
7. 단일 사용자 제보

## 11. 데이터 신뢰도

병원별 `confidence_score`를 운영한다.

예시:

- 90~100: 병원 직접 인증 + 최근 확인
- 75~89: 공식 홈페이지 또는 전화로 최근 확인
- 50~74: 일정 기간 지난 공식 정보
- 30~49: 공공데이터 + 일부 외부정보
- 0~29: 공공데이터만 존재하거나 오래된 정보

### Freshness 표시

- 7일 이내: 🟢 최신
- 8~30일: 🟡 확인됨
- 31~90일: 🟠 재확인 필요
- 90일 초과: 🔴 오래된 정보

## 12. 운영시간 데이터 모델

```
hospital_hours
- hospital_id
- day_of_week
- open_time
- close_time
- night_open_time
- night_close_time
- emergency_open_time
- emergency_close_time
- is_24h_general
- is_24h_emergency
- is_closed
- break_start
- break_end
- source_type
- verified_at
```

### 특별 운영시간

```
hospital_special_hours
- hospital_id
- date
- open_time
- close_time
- emergency_open_time
- emergency_close_time
- is_closed
- reason
- verified_at
```

설날·추석·공휴일·임시휴진은 일반 요일 스케줄보다 우선 적용한다.

### 자정 넘김 / 시간대 규칙

- 모든 시간은 **KST 고정**, 상태 계산은 **서버 시각 기준**으로 서버에서 수행한다(클라이언트 시계 신뢰 금지).
- 시간은 해당 요일 00:00 기준 **분 단위 정수(0~2880)** 로 저장한다. 예: 응급 19:00~익일 09:00 = `emergency_open=1140, emergency_close=1980`. `close < open` 형태의 모호한 저장을 금지한다.
- 자정 이후 조회 시 전날 요일의 구간도 함께 평가한다.
- 병원 레벨 요약 플래그(`is_24h_general`, `is_24h_emergency`, `night_emergency`)는 요일 데이터에서 파생하되 `hospital`에 캐시한다.

## 13. 현재 진료 상태 계산

상태 값:

```
OPEN
NIGHT_OPEN
EMERGENCY_ONLY
CLOSED
UNKNOWN
```

판단 순서:

```
현재 날짜/요일
  ↓
특별 운영시간 확인
  ↓
임시휴진 확인
  ↓
일반 진료시간 확인
  ↓
야간/응급시간 확인
  ↓
실시간 응급접수 상태 확인
```

시간표로만 계산된 상태와 병원이 직접 업데이트한 상태를 반드시 구분한다.

## 14. 추천 Ranking

단순 거리순으로 정렬하지 않는다.

예시 점수:

```
현재 진료 가능      40
응급진료 가능      25
데이터 신뢰도      15
거리                10
진료동물 일치      10
```

500m 거리에 있지만 정보가 불확실한 병원보다 1.5km 거리에 있고 현재 응급접수가 확인된 병원을 먼저 보여주는 것이 핵심이다.

### 거리 처리 규칙

거리는 점수 항목이 아니라 **하드 컷 + 감쇠**로 다룬다. 위 가중치만으로는 30km 병원이 500m 병원 위로 올라올 수 있다.

- 1차 조회 반경 안(§16)의 병원만 Ranking 대상
- 거리 점수 10점은 `10 × max(0, 1 − distance / radius)` 로 감쇠
- 반경 내 `현재 진료 가능` 병원이 3개 미만일 때만 반경을 자동 확대

## 15. DB 설계

### hospital

```
id
license_number
name
road_address
jibun_address
latitude
longitude
phone
business_status
opened_at
closed_at
source_updated_at
location            -- geography(Point, 4326), GIST index
is_24h_general      -- hospital_hours에서 파생·캐시
is_24h_emergency
night_emergency
confidence_score    -- §11
last_verified_at    -- §17 응답용 요약
realtime_status     -- 병원 직접 갱신 (P2), TTL 3h
realtime_updated_at
created_at
updated_at
```

### hospital_phone

야간 응급 전용 번호가 대표번호와 다른 병원이 많으므로 전화번호를 분리한다.

```
hospital_id
phone_type   -- main / night / emergency
phone
verified_at
source_type
```

### hospital_hours

```
hospital_id
day_of_week
open_time
close_time
night_open_time
night_close_time
emergency_open_time
emergency_close_time
is_24h_general
is_24h_emergency
is_closed
verified_at
source_type
```

### species

```
id
code
name
```

### hospital_species

```
hospital_id
species_id
verified_at
source_type
```

### hospital_facility

```
hospital_id
facility_type
verified
verified_at
source_type
```

### hospital_verification

```
id
hospital_id
field_name
source_type
source_url
verified_at
verified_by
confidence
```

### report

```
id
hospital_id
user_id
report_type
description
status
created_at
resolved_at
```

### hospital_change_log

```
id
hospital_id
change_type
before_value
after_value
detected_at
```

## 16. 위치 검색

추천 DB: **PostgreSQL + PostGIS**

반경 검색 예시:

```sql
SELECT *
FROM hospital
WHERE ST_DWithin(
  geography(location),
  geography(ST_MakePoint(:lng, :lat)),
  :radius_meter
);
```

기본 조회 반경은 도심 5~10km, 결과가 부족하면 자동 확대한다.

## 17. API 예시

```javascript
GET /api/v1/hospitals/nearby
```

Parameters:

```
lat
lng
radius
openNow
emergency
night
species
facilities
```

응답 예시:

```json
{
  "hospitalId": 123,
  "name": "24시 OO동물의료센터",
  "distance": 1240,
  "openStatus": "EMERGENCY_ONLY",
  "is24hEmergency": true,
  "emergencyAvailable": true,
  "confidenceScore": 92,
  "lastVerifiedAt": "2026-08-17T21:30:00+09:00"
}
```

## 18. 데이터 Batch

매일 정기 실행:

```
공공데이터 수집
  ↓
raw_hospital 적재
  ↓
Normalize
  ↓
기존 병원 Match
  ↓
신규 / 수정 / 폐업 Diff
  ↓
hospital 업데이트
  ↓
change_log 기록
  ↓
검증 필요 병원 Queue 생성
```

### 자동 품질검사

- 국내 범위를 벗어난 좌표
- 전화번호 형식 오류
- 병원명 NULL
- 주소 NULL
- 영업 중인데 폐업일 존재
- 중복 병원 후보
- 90일 이상 미검증 응급병원

## 19. 중복 병원 정제

매칭 기준 예시:

```
인허가번호       최우선
병원명           40%
주소             35%
전화번호         25%
```

- 90점 이상: 자동 동일 후보
- 60~89점: 관리자 검토
- 60점 미만: 별도 병원

자동 병합 전에 원본 값을 보존한다.

## 20. 관리자 기능

### Dashboard

- 전체 영업 병원
- 24시간 응급병원
- 야간진료 병원
- 최근 신규 병원
- 폐업 감지 병원
- 정보 오류 신고 병원
- 30/90일 이상 미검증 병원

### Verification Queue

우선순위:

1. 사용자 오류 신고 발생
2. 24시간/응급 병원
3. 조회수 높은 병원
4. 공공데이터 변경 감지
5. 장기간 미검증

## 21. 알림

P1 이후:

- 관심지역 신규 24시간 병원
- 즐겨찾는 병원의 운영정보 변경
- 공휴일 운영 안내

반경 설정 예:

- 3km
- 5km
- 10km
- 20km

## 21-1. 데이터 구축 공수 및 운영 모델

이 프로젝트의 병목은 코드가 아니라 **검증 인력 시간**이다. 다음 가정으로 계획한다.

### 초기 구축 (출시 전)

- 대상: 수도권 야간/응급 후보 병원 약 300~400개
- 병원당 검증 공수: 홈페이지 확인 5분 + 전화 확인 5분 + 입력 3분 ≈ **13분**
- 총 공수: **약 65~90시간** (하루 3시간 기준 4~6주)
- 전화 검증은 병원 비응급 시간대(평일 14~17시)에 진행

### 상시 운영

- 재검증 주기: 응급/24시간 병원 90일, 일반 병원 180일
- 월 예상 공수: 재검증 ~10시간 + 제보 처리 ~3시간 + 배치 QA ~2시간 ≈ **월 15시간**

### 공수 절감 전략

1. 병원 셀프 등록/인증 유도 (인증 배지 + 상위 노출 근거 제공)
2. 사용자 👍/👎 피드백(§27)으로 재검증 우선순위 자동화
3. Phase 1 지역 밖은 셀프 등록 + 제보만으로 운영

**담당:** 초기 구축은 1인 개발자 직접 수행. 월 15시간을 넘기면 파트타임 검증 인력(시급 기준) 투입을 검토한다.

## 22. 수익 모델

### 1단계 — AdMob

- 지도 하단 배너
- 병원 리스트 중간 Native Ad
- 상세페이지 최하단 광고

**응급 CTA보다 위에 광고를 배치하지 않는다.**

### 2단계 — 병원 스폰서 영역

광고임을 명확하게 표시하고 일반 Ranking과 분리한다.

### 3단계 — 병원 SaaS

병원이 직접 다음을 관리:

- 진료시간
- 임시휴진
- 응급접수 상태
- 의료진 / 진료과목
- 시설
- 통계

예상 월 요금 후보: 19,000~49,000원.

### 수익 현실성 메모

응급앱은 저빈도 사용이라 MAU 10,000이어도 AdMob 수익은 **월 수만 원 수준**이다. 아이디어 평가의 "수익성 높음"은 3단계 병원 SaaS를 전제로 한 것이며, 1~2단계는 데이터 구축 비용을 회수하지 못한다고 가정한다. 병원 스폰서 노출은 수의사법 동물병원 광고 규정(거짓·과장 광고 금지)을 확인한 뒤 진행한다.

## 23. Analytics

핵심 이벤트:

```
app_open
location_permission_allow
hospital_search
filter_open_now
filter_24h
filter_emergency
hospital_marker_click
hospital_detail_view
hospital_call_click
hospital_navigation_click
hospital_report
hospital_favorite
```

### North Star Metric

**병원 상세 → 전화 또는 길찾기 전환율**

핵심 Funnel:

```
App Open
→ Hospital Search
→ Hospital Detail
→ Call
→ Navigation
```

## 24. 초기 KPI

- 지도 검색 → 병원 상세 CTR: 25%+
- 상세 → 전화 클릭률: 15%+
- 상세 → 길찾기 클릭률: 20%+
- 야간 검색 성공률: 90%+ — 정의: 22~06시 검색 세션 중 병원 상세에서 전화 또는 길찾기까지 도달한 비율
- 운영정보 정확도: 👍/👎 피드백(§27) 중 👎 비율 5% 이하 — 단순 신고율은 신고가 없어도 달성되므로 지표로 쓰지 않는다
- 정보 오류 신고 처리 시간: 중앙값 48시간 이내
- Crash-free: 99.5%+
- 출시 6개월 MAU 목표: 10,000

## 25. 개인정보 및 보안

- 비회원으로 핵심 기능 사용 가능
- 위치정보는 주변 검색에 필요한 범위에서만 처리
- 기본 정책으로 지속적인 위치 이동 이력을 저장하지 않음
- 회원 기능은 즐겨찾기·알림 등에 필요한 최소 정보만 수집
- 관리자 수정 이력과 데이터 출처를 Audit Log로 남김

### 법적 확인 항목 (출시 전)

- 위치정보법상 위치기반서비스사업 신고 의무 여부 확인 (소상공인·1인 창조기업 신고 면제/통보 요건 포함)
- 병원 홈페이지 정보 수집 시 저작권·이용약관 확인. 네이버 플레이스·카카오맵 등 **플랫폼 리스팅 크롤링은 금지**
- 병원 담당자 개인정보(이름·연락처) 수집 항목·보관기간을 개인정보처리방침에 명시
- 지도 API 데이터 영구 저장 금지 조항 (§9-E)

## 26. 의료·법적 주의사항

병원 상세 하단:

> 병원 운영시간 및 진료 가능 여부는 실제 상황에 따라 변경될 수 있습니다. 응급 상황에서는 방문 전 병원에 전화하여 진료 가능 여부를 확인해 주세요.

응급 정보 콘텐츠:

> 본 서비스는 수의사의 진료 또는 의학적 판단을 대체하지 않습니다.

MVP에서는 AI 질병 진단·치료 추천 기능을 제외한다.

## 27. 리뷰 정책

일반 별점 리뷰는 MVP에서 제외한다.

대신 데이터 정확도 피드백 중심:

> 실제로 야간 진료를 했나요?
> 👍 네 / 👎 아니요

이를 운영정보 검증 데이터로 활용한다.

## 28. 권장 기술 스택

### Mobile

- Flutter

### Backend — 결정(2026-08-18): 백엔드 API 서버 없음. 정적 JSON + Firebase.

- **데이터:** 행안부 동물병원 API → GitHub Actions(`scripts/pipeline.py`, uv, 매일 03:15 KST) → `docs/{hospitals,meta,holidays}.json` → GitHub Pages `https://dongil618.github.io/pet_er_map/`. 앱은 ETag/디스크 캐시/오프라인 폴백으로 fetch하고, 반경검색·필터·진료상태·랭킹은 클라이언트에서 계산한다.
- **검증 운영정보**(진료시간·진료동물·시설·verified_at·source)는 리포의 `data/overrides/<관리번호>.yaml` (git-as-CMS)로 관리 → 파이프라인이 병합. 별도 Admin 웹 없음.
- **Firebase:** Analytics(§23 이벤트), Crashlytics, Firestore `reports`/`feedback` create-only(제보·👍👎). 설정 없으면 앱은 자동 no-op.
- **MVP 제외:** Supabase/PostGIS, Next.js Admin, 실시간 혼잡도 서버. 필요해지면 hospitals.json 계약(`docs/DATA.md`)을 유지한 채 백엔드로 교체 가능.
- **코드:** GitHub `dongil618/pet_er_map` (private).

> **구현 노트:** §9-B의 "Backend Batch → Hospital DB → App API", §12의 "서버 시각 기준 상태 계산", §15 DB 설계, §16 PostGIS 반경 검색, §17 `/api/v1/hospitals/nearby`, §18 Batch, §20 관리자 기능은 위 결정에 따라 정적 JSON 파이프라인 + 클라이언트 계산 + `data/overrides` YAML로 대체된다. 원문은 참고용으로 그대로 보존한다.

#### (참고 · 이전 안) Backend — Supabase (선택안 A)

1인 개발·MVP 규모에서는 A로 확정한다. B(Spring)는 병원 SaaS 단계에서 재검토.

- Supabase
- PostgreSQL
- PostGIS
- Edge Functions

#### (참고 · 이전 안) Backend 선택안 B — 확장형

- Kotlin / Spring Boot
- PostgreSQL
- PostGIS
- Redis

### 지도 SDK (미결 → Sprint 2 전 결정)

후보: Naver Map / Kakao Map / Google Maps. 판단 기준: 국내 야간 도로·POI 품질, 무료 호출 한도, Flutter 플러그인 성숙도, 길찾기 딥링크 호환. 기본 가설은 Naver Map.

### 공통

- Firebase Cloud Messaging
- Firebase Analytics
- Firebase Crashlytics
- GitHub Actions
- ~~Next.js Admin~~ (MVP 제외 · `data/overrides` YAML로 대체)

## 29. 출시 지역 전략

전국 Master DB는 처음부터 구축하되 야간·응급 데이터 검증은 단계적으로 진행한다.

### Phase 1

서울 / 경기 / 인천

### Phase 2

부산 / 대구 / 대전 / 광주 / 울산 / 세종

### Phase 3

전국 확대

## 30. 출시 전 데이터 목표

- 전국 동물병원 Master DB 확보
- 폐업·중복·좌표 오류 정제
- 수도권 야간·24시간 응급병원 집중 검증
- 최소 300개 이상의 야간/응급 병원 운영정보 확보를 목표로 하되 실제 확보 수에 따라 출시 범위를 조정

공공데이터에서 확보 가능한 기본정보와 직접 구축해야 할 데이터를 분리한다.

### 공공데이터 기반

- 병원명
- 주소
- 영업상태
- 인허가
- 위치 기본값

### 직접 구축 핵심 자산

- 전화번호 보정
- 진료시간
- 24시간 여부
- 야간진료
- 응급진료
- 진료동물
- 응급수술
- 입원
- 의료시설
- 마지막 확인시간
- 실시간 응급접수 상태

## 31. MVP 개발 순서

### Sprint 1 — 데이터

- 공공데이터 수집
- Hospital DB
- 좌표 정규화
- 중복 제거
- 변경감지

### Sprint 2 — 지도

- Flutter 지도
- 현재 위치
- 병원 마커
- 리스트
- 상세
- 전화
- 길찾기

### Sprint 3 — 핵심 차별화

- 운영시간
- 지금 진료중 계산
- 24시간 / 야간 / 응급 필터
- 데이터 신뢰도
- 마지막 확인시간

### Sprint 4 — 운영

- 관리자 페이지
- 병원 검증 Queue
- 조회수 집계 파이프라인 (Analytics → DB, 검증 큐 우선순위 3번 항목용)
- 사용자 제보 + 스팸 방지
- Analytics
- AdMob

### 기간 가정

Sprint당 2주, 총 10주. 단 §21-1의 데이터 검증(65~90시간)은 Sprint 1~4와 병행하며 별도 트랙으로 관리한다.

### Sprint 5 — 출시

- 데이터 QA
- 앱 QA
- 개인정보처리방침 / 이용약관
- 앱 아이콘 / 스크린샷
- ASO
- Play Store / App Store 등록

## 32. MVP 제외 기능

- AI 질병 진단
- 수의사 온라인 상담
- 병원 예약
- 결제
- 펫보험
- 의료기록 통합
- 커뮤니티
- 일반 SNS 기능
- 쇼핑
- 미용 / 호텔

핵심 목적은 **"아픈 반려동물을 지금 데려갈 병원을 찾는다."**에 집중한다.

## 33. ASO 키워드

- 동물병원
- 24시 동물병원
- 야간 동물병원
- 응급 동물병원
- 강아지 응급실
- 고양이 응급실
- 주말 동물병원
- 일요일 동물병원
- 특수동물 병원

앱 이름 후보:

> **펫응급맵 - 24시·야간 동물병원 찾기**

## 34. 주요 리스크

### Risk 1 — 야간 정보 오류

대응: `last_verified_at`, `confidence_score`, 병원 인증, 사용자 제보, 정기 검증.

### Risk 2 — 24시 표현 오인

`is_24h` 하나로 관리하지 않고 최소 다음을 분리한다.

```
is_24h_general
is_24h_emergency
night_emergency
```

### Risk 3 — 낮은 재방문율

응급 상황은 빈도가 낮으므로 즐겨찾기, 공휴일 운영, 신규 병원 알림 등으로 확장한다.

### Risk 4 — 지도 플랫폼 대체 가능성

방어력은 지도 UI가 아니라 **검증된 응급 운영 데이터**에서 확보한다.

## 35. 성공 조건

MVP의 성공은 병원을 많이 보여주는 것이 아니다.

> **밤 1시에 보호자가 앱을 열었을 때 실제로 갈 수 있는 병원을 빠르고 정확하게 찾을 수 있는가?**

초기 리소스 권장 배분:

```
지도 / UI        20%
검색 / 필터      20%
데이터 구축      40%
검증 / 운영      20%
```

최종적으로 서비스의 핵심 해자는 **Verified 야간·24시간·응급 동물병원 데이터셋**이다.
