# -*- coding: utf-8 -*-
"""3번: 연관 순위를 점수 항목으로 넣으면 순서가 실제로 바뀌는가."""
import io, json, os, re, urllib.request, statistics as st
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE,'..','..'))
cfg = io.open(os.path.join(ROOT,'backend/src/main/resources/application-local.yml'), encoding='utf-8').read()
KEY = re.search(r'service-key:\s*"([^"]+)"', cfg).group(1)
cn = json.load(io.open(os.path.join(HERE,'..','forecast-drift','gyeongju-2026-08-30.json'), encoding='utf-8'))

url = ('https://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1'
       f'?serviceKey={KEY}&MobileOS=ETC&MobileApp=PEAKOFF&_type=json'
       '&numOfRows=20000&pageNo=1&baseYm=202504&areaCd=47&signguCd=47130')
items = [it for it in json.loads(urllib.request.urlopen(url,timeout=60).read().decode('utf-8'))
         ['response']['body']['items']['item'] if str(it.get('rlteSignguCd','')).strip()=='47130']

def norm(s): return re.sub(r'\s+','',re.sub(r'[\[\(].*?[\]\)]','',s))
cnorm = {norm(k): k for k in cn}
def q(name, date='20260905'):
    k = cnorm.get(norm(name))
    if k is None:
        c = [kk for nk,kk in cnorm.items() if norm(name) in nk or nk in norm(name)]
        if len(c)!=1: return None
        k = c[0]
    v = cn[k].get(date)
    return None if v is None else 100-v

by = {}
for it in items:
    by.setdefault(it['tAtsNm'].strip(), []).append((int(it.get('rlteRank',0) or 0), it['rlteTatsNm'].strip()))

print('='*76)
print('H. 연관 후보 중 "예측이 있는 곳"만 남으면 순위가 어떻게 흩어지나 (경주 · 9/5 기준)')
print('='*76)
spreads, kept = [], []
for origin, rows in by.items():
    surv = sorted((rk, nm, q(nm)) for rk, nm in rows if q(nm) is not None)
    if len(surv) < 2: continue
    kept.append(len(surv)); spreads.append((origin, surv))
print(f'기준 관광지 {len(by)}곳 중 예측 있는 연관 후보가 2곳 이상인 곳: {len(spreads)}곳')
print(f'남는 후보 수: 중앙 {st.median(kept):.0f}곳 (최소 {min(kept)} · 최대 {max(kept)})')

print('\n── 표본 5곳: 연관 순위(rk)와 한적도(q) — 둘이 같은 방향인가')
for origin, surv in spreads[:5]:
    print(f'  {origin:14s} ' + ' '.join(f'{rk}위/q{qq:.0f}' for rk,_,qq in surv[:7]))

import itertools
conc = dis = 0
for _, surv in spreads:
    for a, b in itertools.combinations(surv, 2):
        if a[2]==b[2]: continue
        (conc, dis) = (conc+1, dis) if (a[0]<b[0]) == (a[2]>b[2]) else (conc, dis+1)
tau = (conc-dis)/(conc+dis)
print(f'\n연관 순위 vs 한적도 순위일치도(켄달 타우) = {tau:+.3f}   (쌍 {conc+dis}개)')
print('  0에 가까우면 두 값이 서로 다른 것을 말한다 = 항목으로 넣을 값어치가 있다')
print('  음수면 "연관이 높을수록 붐빈다"는 뜻 = 넣으면 붐비는 곳을 밀게 된다')
