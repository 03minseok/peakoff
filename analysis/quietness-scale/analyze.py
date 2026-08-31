# -*- coding: utf-8 -*-
"""1번(변환식)·2번(3단계 경계) 판단을 위한 분포 실측."""
import io, json, os, statistics as st
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = {
    '경주':   os.path.join(HERE, '..', 'forecast-drift', 'gyeongju-2026-08-30.json'),
    '제주시': os.path.join(HERE, 'jeju-2026-08-30.json'),
    '서귀포': os.path.join(HERE, 'seogwipo-2026-08-30.json'),
}
data = {r: json.load(io.open(p, encoding='utf-8')) for r, p in FILES.items()}

def q(v): return 100.0 - v          # 지금의 변환식
def level(x, hi=70, lo=40):
    return '한적' if x >= hi else ('보통' if x >= lo else '붐빔')

print('=' * 78)
print('A. 집중률 원자료 분포 (장소×날짜 전수)')
print('=' * 78)
allv = []
for r, d in data.items():
    vs = [v for s in d.values() for v in s.values()]
    allv += vs
    vs.sort()
    p = lambda f: vs[int(len(vs) * f)]
    print(f'{r:4s} n={len(vs):5d}  min {min(vs):5.1f}  p10 {p(.10):5.1f}  p25 {p(.25):5.1f}  '
          f'중앙 {p(.50):5.1f}  p75 {p(.75):5.1f}  p90 {p(.90):5.1f}  max {max(vs):5.1f}  평균 {st.mean(vs):5.1f}')
allv.sort()
p = lambda f: allv[int(len(allv) * f)]
print(f'{"전체":4s} n={len(allv):5d}  min {min(allv):5.1f}  p10 {p(.10):5.1f}  p25 {p(.25):5.1f}  '
      f'중앙 {p(.50):5.1f}  p75 {p(.75):5.1f}  p90 {p(.90):5.1f}  max {max(allv):5.1f}  평균 {st.mean(allv):5.1f}')

print()
print('=' * 78)
print('B. 지금 경계(70/40)에서 3단계가 어떻게 갈리나  ─ 한적도 = 100 - 집중률')
print('=' * 78)
print(f'{"":8s} {"한적":>16s} {"보통":>16s} {"붐빔":>16s}')
for r, d in data.items():
    qs = [q(v) for s in d.values() for v in s.values()]
    c = Counter(level(x) for x in qs)
    n = len(qs)
    print(f'{r:8s} ' + ' '.join(f'{c[k]:7d} ({c[k]/n:5.1%})' for k in ('한적', '보통', '붐빔')))
qs_all = [q(v) for v in allv]
c = Counter(level(x) for x in qs_all); n = len(qs_all)
print(f'{"전체":8s} ' + ' '.join(f'{c[k]:7d} ({c[k]/n:5.1%})' for k in ('한적', '보통', '붐빔')))

print()
print('── 화면이 실제로 겪는 것: 장소 하나가 30일 동안 배지를 몇 종류나 쓰나')
for r, d in data.items():
    kinds = Counter(len(set(level(q(v)) for v in s.values())) for s in d.values())
    print(f'{r:8s} 한 종류만 {kinds[1]:3d}곳 · 두 종류 {kinds[2]:3d}곳 · 세 종류 {kinds[3]:3d}곳  (총 {len(d)}곳)')

print()
print('── 하루치 지역 평균(홈 주간 예보가 보는 값)의 등급')
for r, d in data.items():
    dates = sorted({dt for s in d.values() for dt in s})
    avgs = [st.mean([q(s[dt]) for s in d.values() if dt in s]) for dt in dates]
    c = Counter(level(a) for a in avgs)
    print(f'{r:8s} 범위 {min(avgs):4.1f}~{max(avgs):4.1f}  →  ' +
          ' · '.join(f'{k} {c[k]}일' for k in ('한적', '보통', '붐빔') if c[k]))
