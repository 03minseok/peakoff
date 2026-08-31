# -*- coding: utf-8 -*-
"""표본의 빈 자리를 메운다.

집중률 API가 아는 시군구 코드가 ldongCode2가 주는 코드보다 낡았다:
 · 광주·전남이 아직 통합 전 코드(29·46)다 — ldongCode2는 통합 코드 12를 준다
 · 자치구가 있는 시(수원·청주·천안·포항·창원·전주)는 시가 아니라 구 단위로만 답한다
 · 2026 개편으로 생긴 인천 제물포구·서해구는 아직 없다
"""
import io, json, os, re, time, urllib.request
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
cfg=io.open(os.path.join(ROOT,'backend/src/main/resources/application-local.yml'),encoding='utf-8').read()
KEY=re.search(r'service-key:\s*"([^"]+)"',cfg).group(1)
OUT=os.path.join(HERE,'snapshots')

EXTRA=[('29','광주광역시','29110','동구'),('29','광주광역시','29140','서구'),
       ('29','광주광역시','29170','북구'),('29','광주광역시','29200','광산구'),
       ('46','전라남도','46110','목포시'),('46','전라남도','46150','순천시'),
       ('46','전라남도','46820','해남군'),('46','전라남도','46910','신안군'),
       ('36','세종특별자치시','36110','세종시'),
       ('28','인천광역시','28110','중구'),('28','인천광역시','28710','강화군'),
       ('41','경기도','41111','수원 장안구'),('43','충청북도','43111','청주 상당구'),
       ('44','충청남도','44131','천안 동남구'),('47','경상북도','47111','포항 남구'),
       ('48','경상남도','48121','창원 의창구'),('52','전북특별자치도','52111','전주 완산구'),
       ('44','충청남도','44760','부여군')]

ok=0
for area,areaNm,signgu,signguNm in EXTRA:
    path=os.path.join(OUT,f'{signgu}.json')
    if os.path.exists(path): continue
    url=('https://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList'
         f'?serviceKey={KEY}&MobileOS=ETC&MobileApp=PEAKOFF&_type=json'
         f'&numOfRows=10000&pageNo=1&areaCd={area}&signguCd={signgu}')
    try:
        body=json.loads(urllib.request.urlopen(url,timeout=60).read().decode('utf-8'))['response']['body']
        items=(body.get('items') or {}); items=items.get('item') if isinstance(items,dict) else None
        snap={}
        for it in (items or []):
            snap.setdefault(it['tAtsNm'].strip(),{})[str(it['baseYmd']).strip()]=float(it['cnctrRate'])
        io.open(path,'w',encoding='utf-8').write(json.dumps(
            {'meta':{'area':area,'areaNm':areaNm,'signgu':signgu,'signguNm':signguNm},'data':snap},ensure_ascii=False))
        ok+=1; print(f'{areaNm} {signguNm:12s} 관광지 {len(snap):4d}곳',flush=True)
    except Exception as e: print(f'{areaNm} {signguNm:12s} 실패 {e}',flush=True)
    time.sleep(0.4)
# 빈 스냅샷 치운다
for f in os.listdir(OUT):
    d=json.load(io.open(os.path.join(OUT,f),encoding='utf-8'))
    if not d['data']: os.remove(os.path.join(OUT,f))
print(f'\n보충 {ok}곳 · 남은 스냅샷 {len(os.listdir(OUT))}개')
