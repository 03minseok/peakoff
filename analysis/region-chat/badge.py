# -*- coding: utf-8 -*-
"""카드에 걸 숫자를 고른다 — <b>평균이 전부 "보통"으로 뭉개졌기 때문이다.</b>

⚠️ 검증용이다. 서비스는 이 파일을 읽지 않는다.

profile.py에서 지역 주간 평균 한적도가 48~63으로 나왔다. 11곳이 전부 보통이라
카드 셋의 배지가 언제나 같다 — 설계가 노린 "한적도 차이가 눈에 보인다"가 성립하지 않는다.
OPEN_DECISIONS 11-1이 적어 둔 함정과 같은 뿌리다: 표본을 늘릴수록 평균은 좁아진다.

그래서 같은 원자료(집중률 예측)에서 <b>폭이 살아 있는 통계</b>를 찾는다.
후보 넷을 같은 자료로 나란히 재고, 지역 간에 실제로 갈리는지 본다.

  A 관측 전체 평균     = 지금 것 (장소 × 7일 전부)
  B 장소별 최고 한적일의 평균   (QuietSpotProvider가 보는 값의 평균)
  C 한적(65+) 비율     = 그 주 한적한 곳이 얼마나 되는가 — 관측 기준
  D 한적한 곳 비율     = 장소마다 가장 한적한 날 기준, 한적 등급인 장소의 몫

⚠️ 개수가 아니라 비율로 본다. 예측 대상이 경주 69곳 ~ 제주시 244곳이라
개수로 걸면 큰 지역이 무엇으로 보든 1등이 된다 (분류를 비율로 본 것과 같은 이유).
"""
import datetime
import io
import json
import os
import statistics
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'today')

REGIONS = [
    ('gyeongju', '경주'), ('jeju', '제주시'), ('seogwipo', '서귀포시'),
    ('yeosu', '여수'), ('sokcho', '속초'), ('taean', '태안'),
    ('chuncheon', '춘천'), ('gapyeong', '가평'), ('chungju', '충주'),
    ('tongyeong', '통영'), ('namwon', '남원'),
]

QUIET_THRESHOLD, MODERATE_THRESHOLD = 65, 35
FORECAST_DAYS = 7


def items_of(data):
    body = data.get('response', {}).get('body', {}) or {}
    items = (body.get('items') or {}).get('item') or []
    return items if isinstance(items, list) else [items]


def forecast(slug):
    rows = items_of(json.load(io.open(os.path.join(OUT, 'forecast-%s.json' % slug), encoding='utf-8')))
    by_name = defaultdict(dict)
    for row in rows:
        try:
            rate = float(row.get('cnctrRate'))
        except (TypeError, ValueError):
            continue
        by_name[(row.get('tAtsNm') or '').strip()][str(row.get('baseYmd'))] = rate
    return by_name


def level_of(q):
    if q is None:
        return '--'
    if q >= QUIET_THRESHOLD:
        return '한적'
    return '보통' if q >= MODERATE_THRESHOLD else '붐빔'


def main():
    today = datetime.date.today()
    days = {(today + datetime.timedelta(d)).strftime('%Y%m%d') for d in range(FORECAST_DAYS)}

    print('%-6s %5s %6s %6s %7s %7s' % ('지역', '장소', 'A평균', 'B최고평균', 'C한적관측%', 'D한적장소%'))
    stats = {}
    for slug, name in REGIONS:
        by_name = forecast(slug)
        observations, bests = [], []
        for byday in by_name.values():
            week = [100.0 - rate for ymd, rate in byday.items() if ymd in days]
            if not week:
                continue
            observations.extend(week)
            bests.append(max(week))
        if not observations:
            print('%-6s  자료 없음' % name)
            continue
        a = round(statistics.mean(observations))
        b = round(statistics.mean(bests))
        c = 100 * sum(1 for q in observations if q >= QUIET_THRESHOLD) / len(observations)
        d = 100 * sum(1 for q in bests if q >= QUIET_THRESHOLD) / len(bests)
        stats[slug] = dict(name=name, n=len(bests), a=a, b=b, c=c, d=d)
        print('%-6s %5d %3d %2s %3d %2s %6.1f %8.1f' % (
            name, len(bests), a, level_of(a), b, level_of(b), c, d))

    print('\n=== 폭 (최대 − 최소) ===')
    for key, label in (('a', 'A 관측 전체 평균'), ('b', 'B 최고 한적일 평균'),
                       ('c', 'C 한적 관측 비율'), ('d', 'D 한적 장소 비율')):
        values = [s[key] for s in stats.values()]
        lo = min(stats.values(), key=lambda s: s[key])
        hi = max(stats.values(), key=lambda s: s[key])
        print('%-16s %6.1f ~ %6.1f  (폭 %5.1f)  최소 %s · 최대 %s' % (
            label, min(values), max(values), max(values) - min(values), lo['name'], hi['name']))

    print('\n=== 세 등급이 갈리는가 (A · B에 배지를 걸었을 때) ===')
    for key, label in (('a', 'A'), ('b', 'B')):
        badges = defaultdict(list)
        for s in stats.values():
            badges[level_of(s[key])].append(s['name'])
        print('%s: %s' % (label, {k: len(v) for k, v in badges.items()}))
        for grade, names in badges.items():
            print('   %s: %s' % (grade, ' '.join(names)))


if __name__ == '__main__':
    main()
