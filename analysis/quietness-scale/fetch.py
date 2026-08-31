# -*- coding: utf-8 -*-
"""세 지역 집중률 전수를 받아 스냅샷으로 남긴다 (OPEN_DECISIONS 1·2번 판단용).

호출은 지역당 한 번, 총 3번이다. 경주는 forecast-drift 스냅샷을 재사용하므로
실제 신규 호출은 제주 둘뿐이다.
"""
import io, json, os, re, sys, datetime, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
REGIONS = {'jeju': ('50', '50110'), 'seogwipo': ('50', '50130')}

cfg = io.open(os.path.join(ROOT, 'backend/src/main/resources/application-local.yml'), encoding='utf-8').read()
KEY = re.search(r'service-key:\s*"([^"]+)"', cfg).group(1)
today = datetime.date.today().isoformat()

for region, (area, signgu) in REGIONS.items():
    url = ('https://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList'
           f'?serviceKey={KEY}&MobileOS=ETC&MobileApp=PEAKOFF&_type=json'
           f'&numOfRows=10000&pageNo=1&areaCd={area}&signguCd={signgu}')
    body = json.loads(urllib.request.urlopen(url, timeout=60).read().decode('utf-8'))['response']['body']
    snap = {}
    for item in body['items']['item']:
        snap.setdefault(item['tAtsNm'].strip(), {})[str(item['baseYmd']).strip()] = float(item['cnctrRate'])
    path = os.path.join(HERE, f'{region}-{today}.json')
    io.open(path, 'w', encoding='utf-8').write(json.dumps(snap, ensure_ascii=False, sort_keys=True))
    print(f'[{region}] 장소 {len(snap)}곳 · 날짜 {len(next(iter(snap.values())))}일 → {os.path.basename(path)}')
