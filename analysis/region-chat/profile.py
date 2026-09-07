# -*- coding: utf-8 -*-
"""챗봇이 지역을 고르는 기준을 실제 자료로 확인한다.

⚠️ 검증용이다. 서비스는 이 파일을 읽지 않는다(공모전 규칙: 데이터는 언제나 OpenAPI 호출).
여기서 정한 규칙만 자바로 옮긴다.

무엇을 보는가
  1. 지역별 <b>분류 비율</b> — 절대 개수로 견주면 카탈로그가 큰 제주시가 무엇으로 보든 1등이 된다
  2. 관심사마다 어느 지역이 남는지 (경계 = 11개 지역의 중앙값)
  3. 그 주 지역별 <b>평균 한적도</b> — 카드에 설 배지
  4. 뽑기를 1,000번 돌려 <b>지역이 고르게 도는지 · 붐비는 곳이 섞이는지</b>
  5. NA(자연·풍경) 중분류를 쪼개 <b>"바다"를 따로 가릴 수 있는지</b>
"""
import datetime
import io
import json
import os
import random
import re
import statistics
import time
import urllib.request
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
cfg = io.open(os.path.join(ROOT, 'backend/src/main/resources/application-local.yml'), encoding='utf-8').read()
KEY = re.search(r'service-key:\s*"([^"]+)"', cfg).group(1)
OUT = os.path.join(HERE, 'today')
os.makedirs(OUT, exist_ok=True)

# SupportedRegion 그대로. (슬러그, 이름, 법정동코드=집중률, 관광정보코드)
REGIONS = [
    ('gyeongju', '경주', '4713000000', '4713000000'),
    ('jeju', '제주시', '5011000000', '5011000000'),
    ('seogwipo', '서귀포시', '5013000000', '5013000000'),
    ('yeosu', '여수', '4613000000', '1213000000'),   # 여수만 코드가 둘이다
    ('sokcho', '속초', '5121000000', '5121000000'),
    ('taean', '태안', '4482500000', '4482500000'),
    ('chuncheon', '춘천', '5111000000', '5111000000'),
    ('gapyeong', '가평', '4182000000', '4182000000'),
    ('chungju', '충주', '4313000000', '4313000000'),
    ('tongyeong', '통영', '4822000000', '4822000000'),
    ('namwon', '남원', '5219000000', '5219000000'),
]

QUIET_THRESHOLD, MODERATE_THRESHOLD = 65, 35     # CongestionLevel
FORECAST_DAYS = 7

CODES = ['FD', 'NA', 'HS', 'VE', 'LS', 'EX', 'SH']
LABELS = dict(FD='음식', NA='자연', HS='역사', VE='문화', LS='레저', EX='체험', SH='쇼핑')


def get(url, path):
    if os.path.exists(path):
        return json.load(io.open(path, encoding='utf-8'))
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:
                data = json.loads(r.read().decode('utf-8'))
            break
        except Exception as e:                                   # noqa: BLE001
            if attempt == 2:
                raise
            print('  재시도(%s): %s' % (attempt + 1, e))
            time.sleep(3)
    json.dump(data, io.open(path, 'w', encoding='utf-8'), ensure_ascii=False)
    return data


def items_of(data):
    body = data.get('response', {}).get('body', {}) or {}
    items = (body.get('items') or {}).get('item') or []
    return items if isinstance(items, list) else [items]


def catalog(slug, tour_code):
    url = ('https://apis.data.go.kr/B551011/KorService2/areaBasedList2'
           '?serviceKey=%s&MobileOS=ETC&MobileApp=PEAKOFF&_type=json'
           '&numOfRows=5000&pageNo=1&arrange=A'
           '&lDongRegnCd=%s&lDongSignguCd=%s' % (KEY, tour_code[:2], tour_code[2:5]))
    rows = items_of(get(url, os.path.join(OUT, 'catalog-%s.json' % slug)))

    # 서버가 버리는 것을 여기서도 버린다 — 좌표 없음·한국 밖·분류 없음 (KtoPlaceClient.toPlace)
    places = []
    for row in rows:
        try:
            lat, lon = float(row.get('mapy') or ''), float(row.get('mapx') or '')
        except ValueError:
            continue
        if not (33.0 <= lat <= 38.7 and 124.5 <= lon <= 132.0):
            continue
        large = (row.get('lclsSystm1') or '').strip()
        title = (row.get('title') or '').strip()
        if not large or not title:
            continue
        places.append((large, (row.get('lclsSystm2') or '').strip(), title))
    return places


def forecast(slug, dong_code):
    url = ('https://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList'
           '?serviceKey=%s&MobileOS=ETC&MobileApp=PEAKOFF&_type=json'
           '&numOfRows=10000&pageNo=1&areaCd=%s&signguCd=%s'
           % (KEY, dong_code[:2], dong_code[:5]))
    rows = items_of(get(url, os.path.join(OUT, 'forecast-%s.json' % slug)))
    by_name = defaultdict(dict)
    for row in rows:
        try:
            rate = float(row.get('cnctrRate'))
        except (TypeError, ValueError):
            continue
        by_name[(row.get('tAtsNm') or '').strip()][str(row.get('baseYmd'))] = rate
    return by_name


def weekly_quietness(by_name, days):
    """그 주 지역 평균 한적도. 예측 대상 전체 × 7일의 단순 평균."""
    values = [100.0 - rate
              for byday in by_name.values()
              for ymd, rate in byday.items() if ymd in days]
    return round(statistics.mean(values)) if values else None


def level_of(q):
    if q is None:
        return '--'
    if q >= QUIET_THRESHOLD:
        return '한적'
    return '보통' if q >= MODERATE_THRESHOLD else '붐빔'


def draw(kept, profiles):
    """설계한 뽑기 — 한적에서 둘, 그 아래에서 하나. 자격선 안에서는 균등."""
    quiet = [s for s in kept if profiles[s]['quietness'] >= QUIET_THRESHOLD]
    below = [s for s in kept if profiles[s]['quietness'] < QUIET_THRESHOLD]
    picked = random.sample(quiet, min(2, len(quiet)))
    if below:
        picked.append(random.choice(below))
    else:
        # 전부 한적한 주 — 남은 것 중 덜 한적한 3분의 1에서 하나. 숫자 차이가 대비를 대신한다
        rest = sorted((s for s in kept if s not in picked), key=lambda s: profiles[s]['quietness'])
        if rest:
            picked.append(random.choice(rest[:max(1, len(rest) // 3)]))
    while len(picked) < 3:
        rest = [s for s in kept if s not in picked]
        if not rest:
            break
        picked.append(random.choice(rest))
    return picked[:3]


def main():
    today = datetime.date.today()
    days = {(today + datetime.timedelta(d)).strftime('%Y%m%d') for d in range(FORECAST_DAYS)}

    profiles = {}
    for slug, name, dong, tour in REGIONS:
        print('· %s' % name)
        places = catalog(slug, tour)
        counts = Counter(large for large, _, _ in places)
        total = len(places)
        profiles[slug] = dict(
            name=name, total=total, counts=counts, places=places,
            share={c: counts[c] / total for c in counts} if total else {},
            quietness=weekly_quietness(forecast(slug, dong), days))

    print('\n=== 1. 지역별 분류 비율 (%) · 카탈로그 크기 · 이번 주 평균 한적도 ===')
    print('%-6s %5s %8s  %s' % ('지역', '전체', '한적도',
                                ' '.join('%5s' % LABELS[c] for c in CODES)))
    for slug, _, _, _ in REGIONS:
        p = profiles[slug]
        q = p['quietness']
        print('%-6s %5d %4s %2s  %s' % (
            p['name'], p['total'], '-' if q is None else q, level_of(q),
            ' '.join('%5.1f' % (100 * p['share'].get(c, 0)) for c in CODES)))

    print('\n=== 2. 관심사마다 남는 지역 (경계 = 11개 지역 비율의 중앙값) ===')
    passing = {}
    for c in CODES:
        shares = [profiles[s]['share'].get(c, 0) for s, _, _, _ in REGIONS]
        cut = statistics.median(shares)
        kept = [s for s, _, _, _ in REGIONS
                if profiles[s]['share'].get(c, 0) >= cut and profiles[s]['quietness'] is not None]
        passing[c] = kept
        print('%-4s 경계 %5.1f%% → %2d곳: %s' % (
            LABELS[c], 100 * cut, len(kept),
            ' '.join(profiles[s]['name'] for s in kept)))

    print('\n=== 3. 뽑기 1,000번 — 지역이 고르게 도는가 · 붐비는 곳이 섞이는가 ===')
    for c in CODES:
        kept = passing[c]
        if not kept:
            continue
        seen, badges, cards = Counter(), Counter(), Counter()
        for _ in range(1000):
            picked = draw(kept, profiles)
            cards[len(picked)] += 1
            for s in picked:
                seen[s] += 1
                badges[level_of(profiles[s]['quietness'])] += 1
        print('%-4s %2d곳이 %d~%d회씩 · 배지 %s · 카드수 %s' % (
            LABELS[c], len(seen), min(seen.values()), max(seen.values()),
            dict(badges), dict(cards)))

    print('\n=== 4. NA(자연·풍경) 중분류 — "바다"를 따로 가릴 수 있는가 ===')
    na, samples = defaultdict(Counter), defaultdict(list)
    for slug, _, _, _ in REGIONS:
        for large, medium, title in profiles[slug]['places']:
            if large == 'NA':
                na[medium][slug] += 1
                if len(samples[medium]) < 6:
                    samples[medium].append(title)
    for medium in sorted(na, key=lambda m: -sum(na[m].values())):
        print('%-6s %4d곳  %s' % (medium or '(없음)', sum(na[medium].values()),
                                  ' / '.join(samples[medium])))


if __name__ == '__main__':
    main()
