"""
공사 집중률 예측이 **같은 날짜에 대해서도 갱신되며 바뀌는지**를 재기 위한 도구.

    python analysis/forecast-drift/snapshot.py

오늘치를 받아 저장하고, 이전 스냅샷이 있으면 겹치는 (장소, 날짜)를 맞대어 변화량을 낸다.

⚠️ **검증용이다. 서비스는 이 파일을 읽지 않는다.**
   공모전 규칙상 서비스 데이터는 언제나 OpenAPI 호출로 가져온다 —
   여기 쌓이는 json은 "예측이 얼마나 흔들리는가"를 재기 위한 연구실 기록이지
   서비스가 참조하는 적재 데이터가 아니다.

키는 gitignore된 backend/src/main/resources/application-local.yml에서 읽는다.
"""
import datetime
import io
import json
import os
import re
import statistics as st
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))

# 경주 한 지역만 재도 충분하다. 69곳 × 30일이면 표본이 2,000쌍이고,
# 호출 한 번이라 공사 일일 한도를 축내지 않는다(OPEN_DECISIONS 15번 사고 참고).
REGIONS = {'gyeongju': ('47', '47130')}


def service_key():
    cfg = io.open(os.path.join(ROOT, 'backend/src/main/resources/application-local.yml'),
                  encoding='utf-8').read()
    return re.search(r'service-key:\s*"([^"]+)"', cfg).group(1)


def fetch(key, area, signgu):
    url = ('https://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList'
           f'?serviceKey={key}&MobileOS=ETC&MobileApp=PEAKOFF&_type=json'
           f'&numOfRows=10000&pageNo=1&areaCd={area}&signguCd={signgu}')
    body = json.loads(urllib.request.urlopen(url, timeout=40).read().decode('utf-8'))['response']['body']
    snap = {}
    for item in body['items']['item']:
        snap.setdefault(item['tAtsNm'].strip(), {})[str(item['baseYmd']).strip()] = float(item['cnctrRate'])
    return snap


def compare(before, after):
    """겹치는 (장소, 날짜)만 맞댄다. 창이 하루씩 밀리므로 첫날은 빠지고 끝에 하루가 붙는다."""
    deltas = []
    for name, series in after.items():
        for date, value in series.items():
            old = before.get(name, {}).get(date)
            if old is not None:
                deltas.append((name, date, old, value))
    return deltas


def main():
    key = service_key()
    today = datetime.date.today().isoformat()

    for region, (area, signgu) in REGIONS.items():
        snap = fetch(key, area, signgu)
        path = os.path.join(HERE, f'{region}-{today}.json')
        io.open(path, 'w', encoding='utf-8').write(
            json.dumps(snap, ensure_ascii=False, sort_keys=True))
        print(f'[{region}] 장소 {len(snap)}곳 저장 → {os.path.basename(path)}')

        olds = sorted(f for f in os.listdir(HERE)
                      if f.startswith(region + '-') and f.endswith('.json')
                      and f != os.path.basename(path))
        if not olds:
            print('  이전 스냅샷이 없다. 내일 다시 돌리면 그때 변화량이 나온다.')
            continue

        prev = olds[-1]
        before = json.load(io.open(os.path.join(HERE, prev), encoding='utf-8'))
        deltas = compare(before, snap)
        if not deltas:
            print(f'  {prev}와 겹치는 (장소, 날짜)가 없다.')
            continue

        changed = [d for d in deltas if abs(d[3] - d[2]) > 1e-9]
        diffs = [abs(d[3] - d[2]) for d in changed]
        print(f'  {prev} 대비 — 겹치는 쌍 {len(deltas)}개 중 '
              f'값이 바뀐 것 {len(changed)}개 ({len(changed) / len(deltas):.1%})')
        if diffs:
            print(f'  변화폭: 평균 {st.mean(diffs):.1f}  중앙 {st.median(diffs):.1f}  최대 {max(diffs):.1f}')
            worst = sorted(changed, key=lambda d: -abs(d[3] - d[2]))[:5]
            for name, date, old, new in worst:
                print(f'    {date} {name[:22]:24} {old:5.1f} → {new:5.1f}  ({new - old:+.1f})')


if __name__ == '__main__':
    main()
