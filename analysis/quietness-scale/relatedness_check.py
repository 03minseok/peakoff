# -*- coding: utf-8 -*-
"""H의 재확인 — 두 지역 · 하루가 아니라 30일 평균으로."""
import io, json, os, re, urllib.request, itertools, statistics as st
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE,'..','..'))
cfg = io.open(os.path.join(ROOT,'backend/src/main/resources/application-local.yml'), encoding='utf-8').read()
KEY = re.search(r'service-key:\s*"([^"]+)"', cfg).group(1)
CN = {'경주': (os.path.join(HERE,'..','forecast-drift','gyeongju-2026-08-30.json'),'47','47130'),
      '제주시': (os.path.join(HERE,'jeju-2026-08-30.json'),'50','50110')}
def norm(s): return re.sub(r'\s+','',re.sub(r'[\[\(].*?[\]\)]','',s))

for r,(path,area,signgu) in CN.items():
    cn = json.load(io.open(path, encoding='utf-8'))
    cnorm = {norm(k): k for k in cn}
    def qmean(name):
        k = cnorm.get(norm(name))
        if k is None:
            c=[kk for nk,kk in cnorm.items() if norm(name) in nk or nk in norm(name)]
            if len(c)!=1: return None
            k=c[0]
        return st.mean(100-v for v in cn[k].values())
    url=('https://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1'
         f'?serviceKey={KEY}&MobileOS=ETC&MobileApp=PEAKOFF&_type=json'
         f'&numOfRows=20000&pageNo=1&baseYm=202504&areaCd={area}&signguCd={signgu}')
    items=[it for it in json.loads(urllib.request.urlopen(url,timeout=60).read().decode('utf-8'))
           ['response']['body']['items']['item'] if str(it.get('rlteSignguCd','')).strip()==signgu]
    by={}
    for it in items: by.setdefault(it['tAtsNm'].strip(),[]).append((int(it.get('rlteRank',0) or 0), it['rlteTatsNm'].strip()))
    conc=dis=0; top=[]; bot=[]
    for rows in by.values():
        surv=sorted((rk,nm,qmean(nm)) for rk,nm in rows if qmean(nm) is not None)
        if len(surv)<2: continue
        for a,b in itertools.combinations(surv,2):
            if a[2]==b[2]: continue
            if (a[0]<b[0])==(a[2]>b[2]): conc+=1
            else: dis+=1
        top += [x[2] for x in surv[:3]]; bot += [x[2] for x in surv[-3:]]
    print(f'{r:5s} 켄달 타우 {(conc-dis)/(conc+dis):+.3f}  (쌍 {conc+dis})   '
          f'연관 상위 3위 평균 한적도 {st.mean(top):4.1f}  vs  하위 3위 {st.mean(bot):4.1f}')
print('\n→ 타우가 음수이고 상위 평균이 하위보다 낮으면: 연관 순위가 높은 곳일수록 붐빈다')
