# -*- coding: utf-8 -*-
"""이름 매칭이 놓치는 곳을 전수로 훑는다.

서버의 진단 API를 그대로 쓴다 — 파이썬으로 매처를 다시 구현하면 규칙이 갈려
"고쳤다고 생각했는데 안 고쳐진" 목록이 나온다.

  ① 카탈로그의 예측 대상 장소를 전부 진단한다 (50칸씩 묶어서)
  ② 자료가 없다고 나온 곳을 모은다
  ③ 아직 아무도 쓰지 않은 집중률 이름과 견주어 짝 후보를 뽑는다

⚠️ 검증용이다. 뽑힌 짝은 <b>제안</b>일 뿐 자동으로 넣지 않는다 —
   잘못 이으면 다른 장소의 혼잡도를 그 장소의 것이라고 말하게 된다.
"""
import io, json, os, re, sys, difflib, urllib.request, datetime
from collections import defaultdict

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
KEY=re.search(r'service-key:\s*"([^"]+)"',
    io.open(os.path.join(ROOT,'backend/src/main/resources/application-local.yml'),encoding='utf-8').read()).group(1)
API='http://localhost:8081/api'
KTO='https://apis.data.go.kr/B551011'
COMMON=f'?serviceKey={KEY}&MobileOS=ETC&MobileApp=PEAKOFF&_type=json'
DATE=(datetime.date.today()+datetime.timedelta(days=5)).isoformat()

# slug: (areaCd, signguCd, lDongRegnCd, lDongSignguCd)
REGIONS={'gyeongju':('경주','47','47130','47','130'),'jeju':('제주시','50','50110','50','110'),
         'seogwipo':('서귀포','50','50130','50','130'),'yeosu':('여수','46','46130','12','130'),
         'sokcho':('속초','51','51210','51','210'),'taean':('태안','44','44825','44','825'),
         'chuncheon':('춘천','51','51110','51','110')}
FORECAST={'HS','NA','VE','LS','EX','EV','SH'}

def kto(path,q):
    b=json.loads(urllib.request.urlopen(f'{KTO}/{path}{COMMON}{q}',timeout=120).read().decode('utf-8'))['response']['body']
    it=(b.get('items') or {}); it=it.get('item') if isinstance(it,dict) else None
    return it or []
def post(p,body):
    r=urllib.request.Request(API+p,data=json.dumps(body).encode('utf-8'),
        headers={'Content-Type':'application/json'},method='POST')
    return json.loads(urllib.request.urlopen(r,timeout=300).read().decode('utf-8'))
def norm(s): return re.sub(r'\s+','',re.sub(r'[\[\(].*?[\]\)]','',s))

out={}
for slug,(label,area,signgu,regn,lsig) in REGIONS.items():
    cat=[it for it in kto('KorService2/areaBasedList2',
            f'&numOfRows=5000&pageNo=1&lDongRegnCd={regn}&lDongSignguCd={lsig}')
         if it.get('lclsSystm1') in FORECAST]
    forecast={it['tAtsNm'].strip() for it in kto('TatsCnctrRateService/tatsCnctrRatedList',
            f'&numOfRows=10000&pageNo=1&areaCd={area}&signguCd={signgu}')}

    missing=[]; matchedNorm=set()
    for i in range(0,len(cat),50):
        chunk=cat[i:i+50]
        slots=[{'day':1,'order':j+1,'placeId':it['contentid']} for j,it in enumerate(chunk)]
        try:
            d=post('/courses/diagnose',{'region':slug,'startDate':DATE,'nights':0,'slots':slots})['data']
        except Exception as e:
            print(f'  {label} {i} 실패 {str(e)[:40]}', file=sys.stderr); continue
        for it,s in zip(chunk,d['slots']):
            if s.get('quietness') is None: missing.append(it)
            else: matchedNorm.add(norm(it['title']))

    # 아무 카탈로그 이름과도 정규화 일치하지 않는 집중률 이름 = 아직 안 쓰인 것
    catNorm={norm(it['title']) for it in cat}
    unused=[f for f in forecast if norm(f) not in catNorm]

    out[slug]={'label':label,'catalog':len(cat),'forecast':len(forecast),
               'missing':[{'id':m['contentid'],'name':m['title'],'c1':m['lclsSystm1'],
                           'x':m.get('mapx'),'y':m.get('mapy')} for m in missing],
               'unused':sorted(unused)}
    print(f'{label:6s} 예측대상 카탈로그 {len(cat):5d}곳 · 진단 안 됨 {len(missing):5d}곳 '
          f'({len(missing)/len(cat):5.1%}) · 안 쓰인 집중률 이름 {len(unused):4d}개')

io.open(os.path.join(HERE,'sweep.json'),'w',encoding='utf-8').write(json.dumps(out,ensure_ascii=False))
print('\n→ sweep.json 저장')
