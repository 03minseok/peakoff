# -*- coding: utf-8 -*-
"""지역을 넷 더한 뒤 <b>서비스 지역 전체 분포</b>로 혼잡 3단계 경계를 다시 잡는다.

⚠️ 검증용이다. 서비스는 이 파일을 읽지 않는다.

지금 경계(65/35)는 2026-08-31에 <b>전국 64개 시군구</b>로 잡았다. 그때는 서비스 지역이
셋(경주·제주 둘)뿐이라 전국을 대신 봐야 했다 — 셋만 보고 잡으면 지역을 늘리는 순간
무너지기 때문이었다.

지역이 열하나가 되면서 사정이 달라졌다. 강원·경기·충북·충남·전남·전북·경북·경남·제주가
모두 들어와 <b>서비스 지역 자체가 전국을 닮았다.</b> 그래서 이제는 우리가 실제로 배지를
붙이는 곳들의 분포로 경계를 잡을 수 있다.
"""
import io, json, os, re, sys, time, urllib.request
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
cfg = io.open(os.path.join(ROOT, 'backend/src/main/resources/application-local.yml'), encoding='utf-8').read()
KEY = re.search(r'service-key:\s*"([^"]+)"', cfg).group(1)
OUT = os.path.join(HERE, 'today')
os.makedirs(OUT, exist_ok=True)

# 지원 지역 일곱 + 새로 넣을 넷. 집중률 API가 받는 (시도 2자리, 시군구 5자리)다.
REGIONS = [
    ('47', '47130', '경북 경주', False), ('50', '50110', '제주 제주시', False),
    ('50', '50130', '제주 서귀포', False), ('46', '46130', '전남 여수', False),
    ('51', '51210', '강원 속초', False), ('44', '44825', '충남 태안', False),
    ('51', '51110', '강원 춘천', False),
    ('41', '41820', '경기 가평', True), ('43', '43130', '충북 충주', True),
    ('48', '48220', '경남 통영', True), ('52', '52190', '전북 남원', True),
]

def fetch(area, signgu):
    path = os.path.join(OUT, f'{signgu}.json')
    if os.path.exists(path):
        return json.load(io.open(path, encoding='utf-8'))
    url = ('https://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList'
           f'?serviceKey={KEY}&MobileOS=ETC&MobileApp=PEAKOFF&_type=json'
           f'&numOfRows=10000&pageNo=1&areaCd={area}&signguCd={signgu}')
    body = json.loads(urllib.request.urlopen(url, timeout=60).read().decode('utf-8'))['response']['body']
    items = (body.get('items') or {})
    items = items.get('item') if isinstance(items, dict) else None
    snap = {}
    for it in (items or []):
        snap.setdefault(it['tAtsNm'].strip(), {})[str(it['baseYmd']).strip()] = float(it['cnctrRate'])
    io.open(path, 'w', encoding='utf-8').write(json.dumps(snap, ensure_ascii=False))
    time.sleep(0.4)
    return snap

data = {}
for area, signgu, name, is_new in REGIONS:
    snap = fetch(area, signgu)
    data[name] = (snap, is_new)
    days = sorted({d for v in snap.values() for d in v})
    print(f'{name:12s} 관광지 {len(snap):4d}곳 · 날짜 {len(days):2d}일 '
          f'({days[0] if days else "-"}~{days[-1] if days else "-"})' + ('   ← 새로 넣을 곳' if is_new else ''),
          flush=True)

def quiet_of(snap):
    return [100 - v for s in snap.values() for v in s.values()]

allq = sorted(q for snap, _ in data.values() for q in quiet_of(snap))
def pc(a, f): return a[min(int(len(a) * f), len(a) - 1)]

print()
print('=' * 78)
print(f'서비스 지역 11곳 전체 — 관광지 {sum(len(s) for s, _ in data.values()):,}곳 · 관측 {len(allq):,}건')
print('=' * 78)
print(f'min {allq[0]:.0f}  p10 {pc(allq,.10):.0f}  p25 {pc(allq,.25):.0f}  중앙 {pc(allq,.50):.0f}  '
      f'p75 {pc(allq,.75):.0f}  p90 {pc(allq,.90):.0f}  max {allq[-1]:.0f}')

print()
print('경계 후보 — 전체 분포에서')
print(f'{"경계":>10s}  {"한적":>7s} {"보통":>7s} {"붐빔":>7s}   {"최소":>6s}  비고')
def split(a, hi, lo):
    c = Counter('한적' if x >= hi else ('보통' if x >= lo else '붐빔') for x in a)
    n = len(a)
    return c['한적'] / n, c['보통'] / n, c['붐빔'] / n

cands = [(65, 35, '지금 (전국 64곳 기준)'),
         (pc(allq, .75), pc(allq, .25), '서비스 11곳 1·3분위'),
         (round(pc(allq, .75)), round(pc(allq, .25)), '위를 정수로'),
         (70, 40, '어림수'), (72, 45, '어림수'), (75, 45, '어림수')]
seen = set()
for hi, lo, note in cands:
    if (hi, lo) in seen: continue
    seen.add((hi, lo))
    a, b, c = split(allq, hi, lo)
    print(f'{hi:4.0f}/{lo:<4.0f}  {a:7.1%} {b:7.1%} {c:7.1%}   {min(a,b,c):6.1%}  {note}')

for hi, lo in [(65, 35), (round(pc(allq, .75)), round(pc(allq, .25)))]:
    print()
    print('=' * 78)
    print(f'경계 {hi}/{lo} 로 봤을 때 지역마다')
    print('=' * 78)
    print(f'{"지역":12s} {"관광지":>5s}  {"한적":>7s} {"보통":>7s} {"붐빔":>7s}   {"최소":>6s}')
    for name, (snap, is_new) in data.items():
        q = quiet_of(snap)
        if not q: continue
        a, b, c = split(q, hi, lo)
        mark = ' ←' if is_new else ''
        print(f'{name:12s} {len(snap):5d}  {a:7.1%} {b:7.1%} {c:7.1%}   {min(a,b,c):6.1%}{mark}')


# ── 격자 탐색 — 전체와 "가장 불리한 지역"을 함께 본다 ────────────────────────
print()
print('=' * 78)
print('격자 탐색 — 전체 최소배지와 가장 불리한 지역의 최소배지')
print('=' * 78)
per_region = [quiet_of(s) for s, _ in data.values()]
best = []
for hi in range(55, 81):
    for lo in range(25, 51):
        if hi - lo < 15:
            continue
        a, b, c = split(allq, hi, lo)
        overall = min(a, b, c)
        worst = min(min(split(q, hi, lo)) for q in per_region)
        # 한 배지가 45%를 넘으면 그 배지가 기본값이 되어 신호를 잃는다 (CLAUDE.md)
        if max(a, b, c) > 0.45:
            continue
        best.append((worst, overall, hi, lo, a, b, c))
best.sort(reverse=True)
print(f'{"경계":>10s}  {"한적":>7s} {"보통":>7s} {"붐빔":>7s}   {"전체최소":>8s} {"최악지역":>8s}')
for worst, overall, hi, lo, a, b, c in best[:10]:
    print(f'{hi:4d}/{lo:<4d}  {a:7.1%} {b:7.1%} {c:7.1%}   {overall:8.1%} {worst:8.1%}')
cur = [x for x in best if x[2] == 65 and x[3] == 35]
if cur:
    worst, overall, hi, lo, a, b, c = cur[0]
    print(f'\n지금 값 65/35 는 이 목록에서 {best.index(cur[0]) + 1}등 '
          f'(전체최소 {overall:.1%} · 최악지역 {worst:.1%})')
else:
    print('\n지금 값 65/35 는 45% 규칙에 걸려 목록에 없다')
