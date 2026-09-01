# -*- coding: utf-8 -*-
"""두 출처를 한 Pool에 섞으면 연관 후보가 밀리는가.

서버의 거르기(분류 호환·15km·예측 있음·개선폭 5점)와 점수식(0.7×한적도 + 0.3×근접도)을
그대로 재현해, 같은 기준 장소에서 두 출처가 어떻게 겨루는지 본다.

⚠️ 검증용이다. 서비스는 이 파일을 읽지 않는다.
"""
import io, json, math, os, re, sys, urllib.request, statistics as st
from collections import Counter

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
KEY=re.search(r'service-key:\s*"([^"]+)"',
    io.open(os.path.join(ROOT,'backend/src/main/resources/application-local.yml'),encoding='utf-8').read()).group(1)
B='https://apis.data.go.kr/B551011'
COMMON=f'?serviceKey={KEY}&MobileOS=ETC&MobileApp=PEAKOFF&_type=json'

REGIONS={'경주':('47','47130','47','130'),'제주시':('50','50110','50','110'),'서귀포':('50','50130','50','130')}
DATE=sys.argv[1] if len(sys.argv)>1 else None

# 서버 상수 (AlternativeStandard · RecommendationScorer · ScoreWeights)
MIN_GAIN=5; MAX_KM=15.0; PENALTY_PER_KM=5.0; W_Q=0.7; W_P=0.3; POOL=3

def call(path,q):
    return json.loads(urllib.request.urlopen(f'{B}/{path}{COMMON}{q}',timeout=90).read().decode('utf-8'))['response']['body']
def items(body):
    it=(body.get('items') or {}); it=it.get('item') if isinstance(it,dict) else None
    return it or []
def norm(s): return re.sub(r'\s+','',re.sub(r'[\[\(].*?[\]\)]','',s))
def km(a,b):
    R=6371.0; p1,p2=math.radians(a[0]),math.radians(b[0])
    dp=p2-p1; dl=math.radians(b[1]-a[1])
    h=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(h))
def prox(d): return max(0.0,min(100.0,100.0-d*PENALTY_PER_KM))
def rec(q,d): return round(W_Q*q+W_P*prox(d))

# PlaceCategories.compatible 근사 — 중분류까지 본다
VE_OUT={'VE05','VE09','VE10'}
def compatible(a1,a2,b1,b2):
    if a1=='HS': return b1=='HS' or b2 in {'VE07','VE06','VE12'}
    if a1=='NA': return b1=='NA' or b2 in {'VE01','VE03'}
    if a1=='VE': return (b1=='VE' and b2 not in VE_OUT) or b2 in {'VE07','VE06','VE12','VE01','VE03'}
    return a1==b1

def run(label,area,signgu,regn,lsig):
    cat={}
    for it in items(call('KorService2/areaBasedList2',f'&numOfRows=5000&pageNo=1&lDongRegnCd={regn}&lDongSignguCd={lsig}')):
        try: x,y=float(it.get('mapx') or 0),float(it.get('mapy') or 0)
        except ValueError: continue
        if not (33<=y<=38.7 and 124.5<=x<=132): continue          # KtoPlaceClient.isInKorea
        cat[norm(it['title'])]={'name':it['title'],'xy':(y,x),
                                'c1':it.get('lclsSystm1',''),'c2':it.get('lclsSystm2','')}
    cn={}
    for it in items(call('TatsCnctrRateService/tatsCnctrRatedList',f'&numOfRows=10000&pageNo=1&areaCd={area}&signguCd={signgu}')):
        cn.setdefault(norm(it['tAtsNm']),{})[str(it['baseYmd']).strip()]=float(it['cnctrRate'])
    date=DATE or sorted({d for s in cn.values() for d in s})[5]
    rel={}
    for it in items(call('TarRlteTarService1/areaBasedList1',f'&numOfRows=20000&pageNo=1&baseYm=202504&areaCd={area}&signguCd={signgu}')):
        if str(it.get('rlteSignguCd','')).strip()!=signgu: continue
        rel.setdefault(norm(it['tAtsNm']),[]).append(norm(it['rlteTatsNm']))

    # 진단 가능한 장소 = 카탈로그에 있고 그날 집중률이 있는 곳
    uni={k:{**cat[k],'q':round(100-cn[k][date])} for k in cat if k in cn and date in cn[k]}

    rows=[]
    for okey in uni:
        o=uni[okey]; oq=o['q']
        relset={r for r in rel.get(okey,[]) if r in uni and r!=okey}
        pools={'연관':[], '지역':[]}
        for k,p in uni.items():
            if k==okey: continue
            d=km(o['xy'],p['xy'])
            if d>MAX_KM: continue
            if not compatible(o['c1'],o['c2'],p['c1'],p['c2']): continue
            if p['q']-oq < MIN_GAIN: continue
            pools['연관' if k in relset else '지역'].append((rec(p['q'],d),p['q'],d,k))
        if not pools['연관'] and not pools['지역']: continue
        rows.append((okey,oq,pools))

    print(f'\n{"="*72}\n[{label}] 방문일 {date} · 기준 장소 {len(rows)}곳 (양쪽 중 하나라도 후보가 있는 곳)\n{"="*72}')
    both=[r for r in rows if r[2]['연관'] and r[2]['지역']]
    print(f'두 출처 모두 후보가 있는 곳: {len(both)}곳')

    # ① 한적도·추천도 분포 비교 (양쪽 다 있는 곳만 — 같은 기준 장소끼리 견준다)
    rq=[c[1] for _,_,p in both for c in p['연관']]; gq=[c[1] for _,_,p in both for c in p['지역']]
    rr=[c[0] for _,_,p in both for c in p['연관']]; gr=[c[0] for _,_,p in both for c in p['지역']]
    rd=[c[2] for _,_,p in both for c in p['연관']]; gd=[c[2] for _,_,p in both for c in p['지역']]
    print(f'  후보 수      연관 {len(rq):5d}   지역 {len(gq):5d}')
    print(f'  한적도 중앙   연관 {st.median(rq):5.1f}   지역 {st.median(gq):5.1f}')
    print(f'  거리(km) 중앙 연관 {st.median(rd):5.1f}   지역 {st.median(gd):5.1f}')
    print(f'  추천도 중앙   연관 {st.median(rr):5.1f}   지역 {st.median(gr):5.1f}')

    # ② 섞어서 추천도 상위 3을 뽑으면 몇 개가 연관인가
    cnt=Counter(); zero=0
    for _,_,p in both:
        merged=sorted(p['연관']+p['지역'], key=lambda c:-c[0])[:POOL]
        n=sum(1 for c in merged if c in p['연관'])
        cnt[n]+=1
        if n==0: zero+=1
    print(f'\n  ■ 섞어서 추천도 상위 {POOL}을 뽑으면 (양쪽 다 있는 {len(both)}곳)')
    for n in sorted(cnt, reverse=True):
        print(f'     연관 {n}개 · 지역 {POOL-n}개 → {cnt[n]:4d}곳 ({cnt[n]/len(both):5.1%})')
    print(f'     ⚠️ 연관이 하나도 못 든 곳: {zero}곳 ({zero/len(both):.1%})')
    return both

allboth=[]
for label,(a,s,r,l) in REGIONS.items():
    allboth += run(label,a,s,r,l)
