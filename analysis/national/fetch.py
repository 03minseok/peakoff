# -*- coding: utf-8 -*-
"""전국 층화표본 집중률 수집 — 혼잡 3단계 경계(OPEN_DECISIONS 2번)를 전국 분포로 잡기 위한 것.

⚠️ 검증용이다. 서비스는 이 파일을 읽지 않는다(공모전 규칙: 데이터는 언제나 OpenAPI 호출).

표본 설계: 16개 시도에서 각 4곳씩 코드 순으로 고르게 뽑는다. 도심·외곽이 섞이도록
무작위가 아니라 등간격으로 고른다(같은 표본을 다시 만들 수 있어야 한다).
서비스 3개 지역은 비교 기준이라 반드시 넣는다.

한 지역이라도 받으면 그만큼 저장한다 — 중간에 끊겨도 이어 돌릴 수 있다.
"""
import io, json, os, re, sys, time, urllib.request, urllib.error

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.abspath(os.path.join(HERE,'..','..'))
cfg=io.open(os.path.join(ROOT,'backend/src/main/resources/application-local.yml'),encoding='utf-8').read()
KEY=re.search(r'service-key:\s*"([^"]+)"',cfg).group(1)
OUT=os.path.join(HERE,'snapshots'); os.makedirs(OUT,exist_ok=True)
PER_SIDO=4
MUST={'47130','50110','50130'}          # 경주 · 제주시 · 서귀포

regions=json.load(io.open(os.path.join(HERE,'regions.json'),encoding='utf-8'))
by_sido={}
for r in regions: by_sido.setdefault(r['area'],[]).append(r)

picked=[]
for area, rows in sorted(by_sido.items()):
    rows=sorted(rows,key=lambda r:r['signgu'])
    n=min(PER_SIDO,len(rows))
    idx=[round(i*(len(rows)-1)/max(n-1,1)) for i in range(n)] if n>1 else [0]
    chosen={rows[i]['signgu']:rows[i] for i in idx}
    for r in rows:
        if r['signgu'] in MUST: chosen[r['signgu']]=r
    picked+=list(chosen.values())
print(f'표본 {len(picked)}개 시군구 / 전국 {len(regions)}개',flush=True)

ok=fail=skip=0
for i,r in enumerate(picked,1):
    path=os.path.join(OUT,f'{r["signgu"]}.json')
    if os.path.exists(path): skip+=1; continue
    url=('https://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList'
         f'?serviceKey={KEY}&MobileOS=ETC&MobileApp=PEAKOFF&_type=json'
         f'&numOfRows=10000&pageNo=1&areaCd={r["area"]}&signguCd={r["signgu"]}')
    try:
        body=json.loads(urllib.request.urlopen(url,timeout=60).read().decode('utf-8'))['response']['body']
        items=(body.get('items') or {})
        items=items.get('item') if isinstance(items,dict) else None
        snap={}
        for it in (items or []):
            snap.setdefault(it['tAtsNm'].strip(),{})[str(it['baseYmd']).strip()]=float(it['cnctrRate'])
        io.open(path,'w',encoding='utf-8').write(json.dumps(
            {'meta':{k:r[k] for k in ('area','areaNm','signgu','signguNm')},'data':snap},ensure_ascii=False))
        ok+=1
        print(f'[{i}/{len(picked)}] {r["areaNm"]} {r["signguNm"]:8s} 관광지 {len(snap):4d}곳',flush=True)
    except Exception as e:
        fail+=1
        print(f'[{i}/{len(picked)}] {r["areaNm"]} {r["signguNm"]:8s} 실패: {e}',flush=True)
        if fail>=5:
            print('연속 실패가 잦다. 한도 소진이 의심되어 멈춘다.',flush=True); break
    time.sleep(0.4)          # 공사 쪽을 몰아치지 않는다
print(f'\n완료 — 성공 {ok} · 실패 {fail} · 건너뜀(이미 있음) {skip}',flush=True)
