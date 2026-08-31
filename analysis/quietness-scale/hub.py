# -*- coding: utf-8 -*-
"""중심 관광지(대표) 풀이 붐비는 쪽으로 기울었는지 — 홈 주간 예보 표본의 출처."""
import io, json, os, re, urllib.request, statistics as st
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
cfg = io.open(os.path.join(ROOT, 'backend/src/main/resources/application-local.yml'), encoding='utf-8').read()
KEY = re.search(r'service-key:\s*"([^"]+)"', cfg).group(1)

REGIONS = {'경주': ('47', '47130'), '제주시': ('50', '50110'), '서귀포': ('50', '50130')}
out = {}
for r, (area, signgu) in REGIONS.items():
    url = ('https://apis.data.go.kr/B551011/LocgoHubTarService1/areaBasedList1'
           f'?serviceKey={KEY}&MobileOS=ETC&MobileApp=PEAKOFF&_type=json'
           f'&numOfRows=500&pageNo=1&baseYm=202504&areaCd={area}&signguCd={signgu}')
    body = json.loads(urllib.request.urlopen(url, timeout=60).read().decode('utf-8'))['response']['body']
    items = body['items']['item']
    out[r] = [(it.get('hubTatsNm', '').strip(), int(it.get('hubRank', 0) or 0)) for it in items]
    print(f'[{r}] 중심 관광지 {len(items)}곳')
io.open(os.path.join(HERE, 'hub-2026-08-30.json'), 'w', encoding='utf-8').write(
    json.dumps(out, ensure_ascii=False))
