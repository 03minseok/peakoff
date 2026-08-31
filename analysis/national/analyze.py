# -*- coding: utf-8 -*-
"""전국 층화표본으로 혼잡 3단계 경계를 다시 잡는다 (OPEN_DECISIONS 2번)."""
import io, json, os, statistics as st
from collections import Counter
HERE=os.path.dirname(os.path.abspath(__file__)); SNAP=os.path.join(HERE,'snapshots')
regs=[]
for f in sorted(os.listdir(SNAP)):
    d=json.load(io.open(os.path.join(SNAP,f),encoding='utf-8')); regs.append((d['meta'],d['data']))
SERVICE={'47130','50110','50130'}

allq=sorted(100-v for _,d in regs for s in d.values() for v in s.values())
svcq=sorted(100-v for m,d in regs if m['signgu'] in SERVICE for s in d.values() for v in s.values())
def pc(a,f): return a[min(int(len(a)*f),len(a)-1)]

print('='*80); print('A. 표본'); print('='*80)
print(f'시도 {len({m["area"] for m,_ in regs})}개 · 시군구 {len(regs)}개 · '
      f'관광지 {sum(len(d) for _,d in regs):,}곳 · 관측 {len(allq):,}건')
print(f'  (서비스 3개 지역: 관광지 517곳 · 관측 {len(svcq):,}건)')

print(); print('='*80); print('B. 한적도 분포 — 전국 vs 서비스 지역'); print('='*80)
for lbl,a in [('전국 표본',allq),('서비스 3개 지역',svcq)]:
    print(f'{lbl:14s} min {a[0]:4.0f}  p10 {pc(a,.10):3.0f}  '
          f'p25 {pc(a,.25):3.0f}  중앙 {pc(a,.50):3.0f}  p75 {pc(a,.75):3.0f}  '
          f'p90 {pc(a,.90):3.0f}  max {a[-1]:4.0f}   평균 {st.mean(a):4.1f}')
print(f'\n→ 전국 1·3분위수 = {pc(allq,.25):.0f} / {pc(allq,.75):.0f}   '
      f'(서비스 3개 지역만 보면 {pc(svcq,.25):.0f} / {pc(svcq,.75):.0f})')

print(); print('='*80); print('C. 경계 후보 — 전국 표본 기준'); print('='*80)
def split(a,hi,lo):
    c=Counter('한적' if x>=hi else ('보통' if x>=lo else '붐빔') for x in a); n=len(a)
    return c['한적']/n, c['보통']/n, c['붐빔']/n
cands=[(70,40,'지금'),(63,30,'서비스 3지역 1·3분위'),(pc(allq,.75),pc(allq,.25),'전국 1·3분위'),
       (65,35,'어림수'),(60,30,'어림수')]
seen=set(); print(f'{"경계":>10s}  {"한적":>7s} {"보통":>7s} {"붐빔":>7s}   비고')
for hi,lo,note in cands:
    if (hi,lo) in seen: continue
    seen.add((hi,lo)); a,b,c=split(allq,hi,lo)
    print(f'{hi:4.0f}/{lo:<4.0f}  {a:7.1%} {b:7.1%} {c:7.1%}   {note}')

print(); print('='*80); print('D. 지역마다 배지가 고르게 쓰이나 (시군구 64곳 각각)'); print('='*80)
for hi,lo in [(70,40),(63,30),(pc(allq,.75),pc(allq,.25))]:
    bad=[]; stuck=0; tot=0
    for m,d in regs:
        q=[100-v for s in d.values() for v in s.values()]
        c=Counter('한적' if x>=hi else ('보통' if x>=lo else '붐빔') for x in q)
        if min(c.get(k,0) for k in ('한적','보통','붐빔'))/len(q) < 0.05:
            bad.append(m['signguNm'])
        for s in d.values():
            tot+=1
            if len({('한적' if 100-v>=hi else ('보통' if 100-v>=lo else '붐빔')) for v in s.values()})==1: stuck+=1
    print(f'{hi:.0f}/{lo:<3.0f} → 세 배지 중 하나가 5%도 안 쓰이는 시군구 {len(bad):2d}/64곳'
          f' · 30일 내내 배지 고정인 관광지 {stuck:4d}/{tot} ({stuck/tot:.1%})')
    if bad: print(f'        {", ".join(bad[:12])}{" …" if len(bad)>12 else ""}')

print(); print('='*80); print('E. 시도별 한적도 중앙값 — 서비스 지역이 전국에서 어디쯤인가'); print('='*80)
sido={}
for m,d in regs:
    sido.setdefault(m['areaNm'],[]).extend(100-v for s in d.values() for v in s.values())
for nm,a in sorted(sido.items(), key=lambda kv:-st.median(kv[1])):
    mark='  ← 서비스' if nm in ('경상북도','제주특별자치도') else ''
    print(f'  {nm:12s} 중앙 {st.median(a):4.1f}   n={len(a):5d}{mark}')
