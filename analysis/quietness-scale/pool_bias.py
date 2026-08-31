# -*- coding: utf-8 -*-
"""대표 관광지 풀 vs 전체 풀 — 한적도 분포를 맞대어 본다."""
import io, json, os, re, statistics as st
from collections import Counter
HERE = os.path.dirname(os.path.abspath(__file__))
CN = {'경주': os.path.join(HERE, '..', 'forecast-drift', 'gyeongju-2026-08-30.json'),
      '제주시': os.path.join(HERE, 'jeju-2026-08-30.json'),
      '서귀포': os.path.join(HERE, 'seogwipo-2026-08-30.json')}
cn = {r: json.load(io.open(p, encoding='utf-8')) for r, p in CN.items()}
hub = json.load(io.open(os.path.join(HERE, 'hub-2026-08-30.json'), encoding='utf-8'))

def norm(s):
    s = re.sub(r'[\[\(].*?[\]\)]', '', s)
    return re.sub(r'\s+', '', s)

def link(name, series):
    """서비스의 양방향 포함 매칭을 거칠게 흉내낸다 (정확한 수가 아니라 기울기를 보려는 것)."""
    n = norm(name)
    if not n: return None
    for k in series:
        if norm(k) == n: return k
    cand = [k for k in series if n in norm(k) or norm(k) in n]
    return cand[0] if len(cand) == 1 else None

def level(x): return '한적' if x >= 70 else ('보통' if x >= 40 else '붐빔')

print('=' * 76)
print('C. 대표 관광지(홈 표본의 출처)만 놓고 보면 — 장소별 30일 평균 한적도')
print('=' * 76)
for r in cn:
    series = cn[r]
    matched = []
    for name, rank in hub[r]:
        k = link(name, series)
        if k: matched.append((rank, name, st.mean([100 - v for v in series[k].values()])))
    matched.sort()
    allq = [st.mean([100 - v for v in s.values()]) for s in series.values()]
    hq = [m[2] for m in matched]
    fmt = lambda v: (f'{min(v):4.1f}~{max(v):4.1f}  중앙 {st.median(v):4.1f}')
    print(f'\n[{r}]  대표 {len(matched)}곳 매칭 / 전체 {len(allq)}곳')
    print(f'  전체 풀   {fmt(allq)}   ' + ' · '.join(f'{k} {Counter(level(x) for x in allq)[k]}' for k in ('한적','보통','붐빔')))
    print(f'  대표 풀   {fmt(hq)}   ' + ' · '.join(f'{k} {Counter(level(x) for x in hq)[k]}' for k in ('한적','보통','붐빔')))
    print('  대표 상위 8곳: ' + ', '.join(f'{n}({q:.0f})' for _, n, q in matched[:8]))
