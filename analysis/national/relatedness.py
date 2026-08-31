# -*- coding: utf-8 -*-
"""3번: 연관 순위와 한적도의 방향이 전국에서도 같은가."""
import io, json, os, re, time, itertools, urllib.request, statistics as st
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
SNAP=os.path.join(HERE,'snapshots')
cfg=io.open(os.path.join(ROOT,'backend/src/main/resources/application-local.yml'),encoding='utf-8').read()
KEY=re.search(r'service-key:\s*"([^"]+)"',cfg).group(1)
# 전국에 흩어지고 관광지가 넉넉한 곳으로 고른다
PICK=['47130','50110','50130','28710','44710','43800','51150','52190','46910','48890','42150','26410']
def norm(s): return re.sub(r'\s+','',re.sub(r'[\[\(].*?[\]\)]','',s))
print(f'{"지역":12s} {"기준":>5s} {"쌍":>7s} {"켄달타우":>9s}  {"연관상위3 한적도":>15s} {"연관하위3":>9s}')
rows=[]
for code in PICK:
    p=os.path.join(SNAP,f'{code}.json')
    if not os.path.exists(p): print(f'{code} 스냅샷 없음'); continue
    snap=json.load(io.open(p,encoding='utf-8')); meta,cn=snap['meta'],snap['data']
    cnorm={norm(k):k for k in cn}
    def qm(name):
        k=cnorm.get(norm(name))
        if k is None:
            c=[kk for nk,kk in cnorm.items() if norm(name) in nk or nk in norm(name)]
            if len(c)!=1: return None
            k=c[0]
        return st.mean(100-v for v in cn[k].values())
    url=('https://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1'
         f'?serviceKey={KEY}&MobileOS=ETC&MobileApp=PEAKOFF&_type=json'
         f'&numOfRows=20000&pageNo=1&baseYm=202504&areaCd={meta["area"]}&signguCd={code}')
    try:
        b=json.loads(urllib.request.urlopen(url,timeout=60).read().decode('utf-8'))['response']['body']
        it=(b.get('items') or {}); it=it.get('item') if isinstance(it,dict) else None
        items=[x for x in (it or []) if str(x.get('rlteSignguCd','')).strip()==code]
    except Exception as e:
        print(f'{meta["signguNm"]:12s} 실패 {e}'); continue
    by={}
    for x in items: by.setdefault(x['tAtsNm'].strip(),[]).append((int(x.get('rlteRank',0) or 0), x['rlteTatsNm'].strip()))
    conc=dis=0; top=[]; bot=[]
    for r2 in by.values():
        surv=sorted((rk,nm,qm(nm)) for rk,nm in r2 if qm(nm) is not None)
        if len(surv)<2: continue
        for a,b2 in itertools.combinations(surv,2):
            if a[2]==b2[2]: continue
            if (a[0]<b2[0])==(a[2]>b2[2]): conc+=1
            else: dis+=1
        top+=[x[2] for x in surv[:3]]; bot+=[x[2] for x in surv[-3:]]
    if conc+dis<100: print(f'{meta["signguNm"]:12s} 표본 부족'); continue
    tau=(conc-dis)/(conc+dis); rows.append((tau,conc+dis))
    print(f'{meta["signguNm"]:12s} {len(by):5d} {conc+dis:7d} {tau:+9.3f}  {st.mean(top):15.1f} {st.mean(bot):9.1f}')
    time.sleep(0.4)
n=sum(r[1] for r in rows)
print(f'\n지역 {len(rows)}곳 · 쌍 {n:,}개 · 가중평균 타우 {sum(t*w for t,w in rows)/n:+.3f}'
      f'   음수 지역 {sum(1 for t,_ in rows if t<0)}/{len(rows)}곳')
