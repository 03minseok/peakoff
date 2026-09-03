# -*- coding: utf-8 -*-
"""지역을 늘릴 후보를 실제 데이터로 거른다 (SupportedRegion 조건 셋).

⚠️ 검증용이다. 서비스는 이 파일을 읽지 않는다(공모전 규칙: 데이터는 언제나 OpenAPI 호출).

조건 셋 — 셋을 <b>모두</b> 통과한 시군구만 SupportedRegion에 들어간다:
  1. 가장 적은 배지가 20% 이상 (65/35 경계)
  2. 집중률 예측이 있는 관광지 40곳 이상
  3. 자치구로 쪼개지지 않은 단일 시군구

여기에 실무 조건을 하나 더 본다 — 국문 관광정보 카탈로그가 비어 있지 않은지.
여수에서 겪은 일이라(코드가 갈려 절반이 빔) 조용한 0건은 오류로 안 보인다.
"""
import io, json, os, re, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
cfg = io.open(os.path.join(ROOT, 'backend/src/main/resources/application-local.yml'), encoding='utf-8').read()
KEY = re.search(r'service-key:\s*"([^"]+)"', cfg).group(1)
OUT = os.path.join(HERE, 'snapshots')
os.makedirs(OUT, exist_ok=True)

HI, LO = 65, 35          # CongestionLevel 경계
MIN_BADGE = 0.20         # 가장 적은 배지
MIN_PLACES = 40          # 집중률 예측 관광지 수

# 시도마다 대표 여행지 후보. 자치구는 조건 3에서 떨어지므로 군·시 위주로 골랐다.
CANDIDATES = [
    ('26', '26710', '부산광역시', '기장군'),
    ('27', '27710', '대구광역시', '달성군'),
    ('27', '27720', '대구광역시', '군위군'),
    ('28', '28710', '인천광역시', '강화군'),
    ('28', '28720', '인천광역시', '옹진군'),
    ('30', '30200', '대전광역시', '유성구'),      # 자치구 — 조건3 확인용
    ('31', '31710', '울산광역시', '울주군'),
    ('36', '36110', '세종특별자치시', '세종시'),
    ('41', '41820', '경기도', '가평군'),
    ('41', '41830', '경기도', '양평군'),
    ('41', '41480', '경기도', '파주시'),
    ('41', '41650', '경기도', '포천시'),
    ('41', '41670', '경기도', '여주시'),
    ('43', '43800', '충청북도', '단양군'),
    ('43', '43150', '충청북도', '제천시'),
    ('43', '43130', '충청북도', '충주시'),
    ('43', '43720', '충청북도', '보은군'),
    ('48', '48220', '경상남도', '통영시'),
    ('48', '48310', '경상남도', '거제시'),
    ('48', '48840', '경상남도', '남해군'),
    ('48', '48850', '경상남도', '하동군'),
    ('48', '48170', '경상남도', '진주시'),
    ('52', '52800', '전북특별자치도', '부안군'),
    ('52', '52790', '전북특별자치도', '고창군'),
    ('52', '52190', '전북특별자치도', '남원시'),
    ('52', '52180', '전북특별자치도', '정읍시'),
    ('52', '52730', '전북특별자치도', '무주군'),
    ('47', '47130', '경상북도', '경주시'),        # 대조군 — 이미 쓰는 지역
]


def get(url):
    return json.loads(urllib.request.urlopen(url, timeout=60).read().decode('utf-8'))


def forecast(area, signgu):
    """집중률 예측 한 지역치. {관광지명: {날짜: 집중률}}"""
    url = ('https://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList'
           f'?serviceKey={KEY}&MobileOS=ETC&MobileApp=PEAKOFF&_type=json'
           f'&numOfRows=10000&pageNo=1&areaCd={area}&signguCd={signgu}')
    body = get(url)['response']['body']
    items = (body.get('items') or {})
    items = items.get('item') if isinstance(items, dict) else None
    snap = {}
    for it in (items or []):
        snap.setdefault(it['tAtsNm'].strip(), {})[str(it['baseYmd']).strip()] = float(it['cnctrRate'])
    return snap


def catalog_count(signgu):
    """국문 관광정보가 그 지역에 가진 관광지 수. 0이면 지역으로 쓸 수 없다."""
    url = ('https://apis.data.go.kr/B551011/KorService2/areaBasedList2'
           f'?serviceKey={KEY}&MobileOS=ETC&MobileApp=PEAKOFF&_type=json'
           f'&numOfRows=1&pageNo=1&lDongRegnCd={signgu[:2]}&lDongSignguCd={signgu[2:5]}')
    body = get(url)['response']['body']
    return int(body.get('totalCount') or 0)


print(f'{"시도":16s} {"시군구":8s} {"예측":>5s} {"카탈로그":>7s}  {"한적":>6s} {"보통":>6s} {"붐빔":>6s}  '
      f'{"최소배지":>7s}  판정', flush=True)
print('-' * 96, flush=True)

rows = []
for area, signgu, areaNm, signguNm in CANDIDATES:
    path = os.path.join(OUT, f'{signgu}.json')
    try:
        if os.path.exists(path):
            saved = json.load(io.open(path, encoding='utf-8'))
            snap, catalog = saved['data'], saved['meta'].get('catalog', -1)
        else:
            snap = forecast(area, signgu)
            catalog = catalog_count(signgu)
            io.open(path, 'w', encoding='utf-8').write(json.dumps(
                {'meta': {'area': area, 'areaNm': areaNm, 'signgu': signgu,
                          'signguNm': signguNm, 'catalog': catalog}, 'data': snap}, ensure_ascii=False))
            time.sleep(0.4)      # 공사 쪽을 몰아치지 않는다
    except Exception as e:
        print(f'{areaNm:16s} {signguNm:8s} 실패: {e}', flush=True)
        continue

    quiet = [100 - v for s in snap.values() for v in s.values()]
    if not quiet:
        print(f'{areaNm:16s} {signguNm:8s} {len(snap):5d} {catalog:7d}  '
              f'{"":6s} {"":6s} {"":6s}  {"":7s}  ✗ 예측 자료 없음', flush=True)
        continue

    n = len(quiet)
    hi = sum(1 for q in quiet if q >= HI) / n
    mid = sum(1 for q in quiet if LO <= q < HI) / n
    low = sum(1 for q in quiet if q < LO) / n
    least = min(hi, mid, low)

    ok_badge = least >= MIN_BADGE
    ok_pool = len(snap) >= MIN_PLACES
    ok_catalog = catalog > 0
    verdict = '○ 통과' if (ok_badge and ok_pool and ok_catalog) else '✗ ' + ' · '.join(
        x for x in [None if ok_badge else '배지 쏠림',
                    None if ok_pool else '예측 40곳 미만',
                    None if ok_catalog else '카탈로그 0건'] if x)

    rows.append((areaNm, signguNm, signgu, len(snap), catalog, hi, mid, low, least, ok_badge and ok_pool and ok_catalog))
    print(f'{areaNm:16s} {signguNm:8s} {len(snap):5d} {catalog:7d}  '
          f'{hi:6.1%} {mid:6.1%} {low:6.1%}  {least:7.1%}  {verdict}', flush=True)

print()
print('통과한 곳 (시도별):')
by_area = {}
for r in rows:
    if r[9]:
        by_area.setdefault(r[0], []).append(r)
for areaNm, items in sorted(by_area.items()):
    items.sort(key=lambda r: -r[8])
    print(f'  {areaNm:16s} ' + ' · '.join(f'{r[1]}(최소배지 {r[8]:.1%} · 예측 {r[3]}곳)' for r in items))
