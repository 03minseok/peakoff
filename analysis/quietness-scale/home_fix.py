# -*- coding: utf-8 -*-
"""경계를 옮기면 홈 주간 예보(대표 풀 하루 평균)가 실제로 갈리는가."""
import io, json, os, re, statistics as st
from collections import Counter
HERE=os.path.dirname(os.path.abspath(__file__))
CN={'경주':os.path.join(HERE,'..','forecast-drift','gyeongju-2026-08-30.json'),
    '제주시':os.path.join(HERE,'jeju-2026-08-30.json'),
    '서귀포':os.path.join(HERE,'seogwipo-2026-08-30.json')}
cn={r:json.load(io.open(p,encoding='utf-8')) for r,p in CN.items()}
hub=json.load(io.open(os.path.join(HERE,'hub-2026-08-30.json'),encoding='utf-8'))
def norm(s): return re.sub(r'\s+','',re.sub(r'[\[\(].*?[\]\)]','',s))
def lv(x,hi,lo): return '한적' if x>=hi else ('보통' if x>=lo else '붐빔')

for r in cn:
    s=cn[r]; nm={norm(k):k for k in s}
    keys=[]
    for name,_ in hub[r]:
        k=nm.get(norm(name))
        if k is None:
            c=[kk for n2,kk in nm.items() if norm(name) in n2 or n2 in norm(name)]
            k=c[0] if len(c)==1 else None
        if k: keys.append(k)
    dates=sorted({d for k in keys for d in s[k]})[:7]
    avg=[st.mean([100-s[k][d] for k in keys if d in s[k]]) for d in dates]
    print(f'\n[{r}] 대표 풀 {len(keys)}곳 · 이레치 하루평균 {min(avg):.0f}~{max(avg):.0f}  ({" ".join(f"{a:.0f}" for a in avg)})')
    for hi,lo in [(70,40),(63,37),(60,35),(55,35)]:
        c=Counter(lv(a,hi,lo) for a in avg)
        print(f'   {hi}/{lo:<3d} → ' + ' · '.join(f'{k} {c[k]}일' for k in ('한적','보통','붐빔') if c[k])
              + ('   ⚠️ 이레 내내 한 배지' if len(c)==1 else ''))
