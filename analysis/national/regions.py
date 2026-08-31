# -*- coding: utf-8 -*-
"""전국 시군구 목록 — 법정동 코드 기준(구 지역코드 API는 26년 폐기 예정이라 쓰지 않는다)."""
import io, json, os, re, urllib.request
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
cfg=io.open(os.path.join(ROOT,'backend/src/main/resources/application-local.yml'),encoding='utf-8').read()
KEY=re.search(r'service-key:\s*"([^"]+)"',cfg).group(1)
B='https://apis.data.go.kr/B551011/KorService2/ldongCode2'
def call(**kw):
    q=''.join(f'&{k}={v}' for k,v in kw.items())
    u=f'{B}?serviceKey={KEY}&MobileOS=ETC&MobileApp=PEAKOFF&_type=json&numOfRows=200&pageNo=1{q}'
    b=json.loads(urllib.request.urlopen(u,timeout=40).read().decode('utf-8'))['response']['body']
    it=b.get('items') or {}
    it=it.get('item') if isinstance(it,dict) else None
    return it or []

out=[]
for sido in call():
    for sgg in call(lDongRegnCd=sido['code']):
        out.append({'area':sido['code'],'areaNm':sido['name'],
                    'signgu':sido['code']+sgg['code'],'signguNm':sgg['name']})
io.open(os.path.join(HERE,'regions.json'),'w',encoding='utf-8').write(json.dumps(out,ensure_ascii=False,indent=0))
print(f'시도 {len({o["area"] for o in out})}개 · 시군구 {len(out)}개')
