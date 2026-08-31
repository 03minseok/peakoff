# -*- coding: utf-8 -*-
"""3번 판단: 연관 순위(rlteRank)가 점수로 쓸 만한 값인가."""
import io, json, os, re, urllib.request, statistics as st
from collections import Counter
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE,'..','..'))
cfg = io.open(os.path.join(ROOT,'backend/src/main/resources/application-local.yml'), encoding='utf-8').read()
KEY = re.search(r'service-key:\s*"([^"]+)"', cfg).group(1)

for r,(area,signgu) in {'경주':('47','47130'),'제주시':('50','50110')}.items():
    url = ('https://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1'
           f'?serviceKey={KEY}&MobileOS=ETC&MobileApp=PEAKOFF&_type=json'
           f'&numOfRows=20000&pageNo=1&baseYm=202504&areaCd={area}&signguCd={signgu}')
    items = json.loads(urllib.request.urlopen(url,timeout=60).read().decode('utf-8'))['response']['body']['items']['item']
    same = [it for it in items if str(it.get('rlteSignguCd','')).strip()==signgu]
    by = {}
    for it in same:
        by.setdefault(it['tAtsNm'].strip(), []).append(int(it.get('rlteRank',0) or 0))
    sizes = [len(v) for v in by.values()]
    ranks = [x for v in by.values() for x in v]
    print(f'\n[{r}] 전체 행 {len(items)} · 같은 시군구 {len(same)} · 기준 관광지 {len(by)}곳')
    print(f'  기준당 연관 수: {min(sizes)}~{max(sizes)}  중앙 {st.median(sizes):.0f}   분포 {dict(sorted(Counter(sizes).items())[:8])}')
    print(f'  rlteRank 값 범위 {min(ranks)}~{max(ranks)}')
    k = next(iter(by))
    ex = sorted([(int(it.get('rlteRank',0) or 0), it['rlteTatsNm'].strip(), it.get('rlteCtgryMclsNm','')) for it in same if it['tAtsNm'].strip()==k])
    print(f'  예: "{k}" → ' + ', '.join(f'{rk}위 {nm}' for rk,nm,_ in ex[:6]))
