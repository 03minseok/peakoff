# -*- coding: utf-8 -*-
"""다음에 어느 시군구를 넣을 수 있나 — 지금 조건 셋으로 후보를 다시 줄 세운다.

⚠️ 검증용이다. 서비스는 이 파일을 읽지 않는다(공모전 규칙: 데이터는 언제나 OpenAPI 호출).

`evaluate.py`는 <b>옛 첫째 조건</b>(가장 적은 배지 20% 이상)으로 후보를 걸렀다. 그 자는
2026-09-03에 버렸다 — 충북·경남을 통째로 떨어뜨렸는데, 이유가 <b>한적 배지가 절반을
넘어서</b>였기 때문이다. 한산한 곳으로 사람을 보내는 것이 이 서비스가 하려는 일인데
그 이유로 빼는 것은 앞뒤가 맞지 않았다.

지금 조건 셋:
  1. 무작위 <b>6칸 코스</b>에서 붐빔이 한 칸 이상 나올 확률 35% 이상
  2. 집중률 예측이 있는 관광지 40곳 이상
  3. 자치구로 쪼개지지 않은 단일 시군구 (+ 국문 관광정보 카탈로그가 비어 있지 않을 것)

■ 왜 6칸인가
배지 비율은 (장소 × 날짜) 관측 전체의 분포인데, <b>사용자가 보는 것은 6칸짜리 코스 하나</b>다.
붐빔이 10.5%뿐인 하동도 6칸이면 32%가 된다 — 대리 지표를 버리고 지키려던 것을 직접 잰다.
지키려는 것은 "그 지역에서 코스를 짜면 고칠 자리가 실제로 나오는가"이다. 한 칸도 안 붐비는
지역만 넣으면 PLACE OFF가 할 일이 없다.

■ 공사를 부르지 않는다
`evaluate.py`가 받아 둔 `snapshots/*.json`을 읽는다. 같은 날 같은 창으로 받은 자료라
후보끼리 견주는 데 문제가 없고, 다시 부르면 예측이 갱신돼 옛 표와 견줄 수 없게 된다.

실행: python next.py
"""

import glob
import io
import json
import os
import random

HI, LO = 65, 35          # CongestionLevel 경계
SLOTS = 6                # 코스 한 개의 칸 수
TRIALS = 2000            # 지역마다 뽑아 보는 코스 수
MIN_CROWDED_RATE = 0.35  # 조건 1
MIN_FORECAST = 40        # 조건 2
SEED = 20260910          # 돌릴 때마다 같은 수가 나오게

HERE = os.path.dirname(os.path.abspath(__file__))

# 이미 서비스에 들어와 있는 시군구 (SupportedRegion). 후보 표에서는 <b>기준선</b>으로만 쓴다.
SUPPORTED = {
    '47130': '경주', '43130': '충주', '48220': '통영', '52190': '남원', '41820': '가평',
}

# 시도마다 하나씩이 원칙이다. 이미 지역이 있는 시도는 "새 시도 열기"가 아니라 "두 번째"가 된다.
COVERED_PROVINCES = {
    '경상북도', '제주특별자치도', '전라남도', '강원특별자치도', '강원도',
    '충청남도', '경기도', '충청북도', '경상남도', '전북특별자치도',
}

# 자치구로만 쪼개진 곳. 조건 3에서 떨어진다 — 시군구 단위 자료가 도시 하나를 대표하지 못한다.
BOROUGH_ONLY = {'30200'}   # 대전 유성구


def badge(quietness: int) -> str:
    if quietness >= HI:
        return 'quiet'
    if quietness >= LO:
        return 'moderate'
    return 'crowded'


def load(path: str):
    d = json.load(io.open(path, encoding='utf-8'))
    return d['meta'], d['data']


def observations(data):
    """(장소, 날짜) 한 칸의 한적도. 집중률이 높을수록 붐비므로 뒤집는다."""
    return [
        (place, date, 100 - rate)
        for place, by_date in data.items()
        for date, rate in by_date.items()
    ]


def crowded_course_rate(data, rng):
    """무작위 6칸 코스에서 <b>붐빔이 한 칸 이상</b> 나올 확률.

    한 코스는 <b>하루의 여섯 자리</b>로 본다 — 날짜를 하나 고르고 그 날의 장소 여섯을 뽑는다.
    (장소, 날짜)를 따로따로 뽑으면 한 코스가 여러 날에 흩어져 요일 효과가 평균으로 뭉개진다.
    사용자의 코스는 그렇게 생기지 않는다.
    """
    by_date = {}
    for place, date, quiet in observations(data):
        by_date.setdefault(date, []).append(quiet)
    dates = [d for d, values in by_date.items() if len(values) >= SLOTS]
    if not dates:
        return None
    hit = 0
    for _ in range(TRIALS):
        picked = rng.sample(by_date[rng.choice(dates)], SLOTS)
        if any(badge(q) == 'crowded' for q in picked):
            hit += 1
    return hit / TRIALS


def verdict(meta, forecast_count, crowded_rate):
    """떨어진 이유를 전부 적는다 — 하나만 적으면 고치면 들어올 것처럼 읽힌다."""
    reasons = []
    if meta['signgu'] in BOROUGH_ONLY:
        reasons.append('자치구')
    if meta['catalog'] == 0:
        reasons.append('카탈로그 0건')
    if forecast_count < MIN_FORECAST:
        reasons.append(f'예측 {forecast_count}곳')
    if crowded_rate is None:
        reasons.append('관측 부족')
    elif crowded_rate < MIN_CROWDED_RATE:
        reasons.append(f'붐빔 {crowded_rate:.1%}')
    return reasons


def main():
    rng = random.Random(SEED)
    rows = []
    for path in sorted(glob.glob(os.path.join(HERE, 'snapshots', '*.json'))):
        meta, data = load(path)
        rate = crowded_course_rate(data, rng)
        rows.append({
            'signgu': meta['signgu'],
            'province': meta['areaNm'],
            'name': meta['signguNm'],
            'forecast': len(data),
            'catalog': meta['catalog'],
            'rate': rate,
            'reasons': verdict(meta, len(data), rate),
        })

    supported = [r for r in rows if r['signgu'] in SUPPORTED]
    candidates = [r for r in rows if r['signgu'] not in SUPPORTED]

    print(f'조건 — 붐빔 {MIN_CROWDED_RATE:.0%}↑ · 예측 {MIN_FORECAST}곳↑ · 단일 시군구'
          f'  (코스 {SLOTS}칸 × {TRIALS}회, seed={SEED})\n')

    print('■ 기준선 — 이미 들어와 있는 곳')
    for r in sorted(supported, key=lambda r: -(r['rate'] or 0)):
        print(f"  {r['province']:10s} {r['name']:6s} 예측 {r['forecast']:3d}곳 · 붐빔 {r['rate']:.1%}")

    passed = [r for r in candidates if not r['reasons']]
    failed = [r for r in candidates if r['reasons']]

    print(f'\n■ 통과 — 다음에 넣을 수 있는 곳 ({len(passed)}곳)')
    print(f"  {'시도':12s} {'시군구':8s} {'예측':>4s} {'카탈로그':>7s} {'붐빔':>7s}  {'시도 상태':8s}")
    for r in sorted(passed, key=lambda r: (r['province'] in COVERED_PROVINCES, -r['rate'])):
        new = '새 시도' if r['province'] not in COVERED_PROVINCES else '두 번째'
        print(f"  {r['province']:12s} {r['name']:8s} {r['forecast']:4d} {r['catalog']:7d} "
              f"{r['rate']:7.1%}  {new:8s}")

    print(f'\n■ 탈락 ({len(failed)}곳)')
    for r in sorted(failed, key=lambda r: -(r['rate'] or 0)):
        rate = f"{r['rate']:.1%}" if r['rate'] is not None else '—'
        print(f"  {r['province']:12s} {r['name']:8s} 예측 {r['forecast']:3d} · 붐빔 {rate:>6s}"
              f"  ✗ {' · '.join(r['reasons'])}")


if __name__ == '__main__':
    main()
