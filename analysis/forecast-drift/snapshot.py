"""공사 집중률 예측이 **같은 날짜에 대해서도 갱신되며 바뀌는지**를 재기 위한 도구.

    python analysis/forecast-drift/snapshot.py

오늘치를 받아 저장하고, 쌓여 있는 이전 스냅샷 **전부**와 맞대어 두 가지를 본다.

    ① 며칠 간격이면 값이 바뀌는가        (1일 뒤엔 그대로여도 일주일 뒤엔 다를 수 있다)
    ② 방문일이 다가오면 값이 바뀌는가    (D-20일 때의 예보와 D-3일 때의 예보)

⚠️ **검증용이다. 서비스는 이 파일을 읽지 않는다.**
   공모전 규칙상 서비스 데이터는 언제나 OpenAPI 호출로 가져온다 —
   여기 쌓이는 json은 "예측이 얼마나 흔들리는가"를 재기 위한 연구실 기록이지
   서비스가 참조하는 적재 데이터가 아니다.

지금까지 나온 것 (2026-08-31):
   8/30 ↔ 8/31 경주 2,001쌍에서 **바뀐 값이 0개**였다. 창은 하루 밀렸는데도
   (8/30 빠지고 9/29 붙음) 겹치는 29일치가 소수점까지 같았다.
   → CLAUDE.md의 "같은 날짜의 예측값도 갱신되며 바뀐다"는 아직 **측정된 사실이 아니다.**
     간격을 벌려 며칠 더 재봐야 한다. 이 스크립트가 그 일을 한다.

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

# 경주만으로도 신호는 잡히지만, 제주 둘을 함께 본다.
# 관광지가 69곳에서 517곳으로 늘어 "일부만 바뀌는" 경우를 놓치지 않고,
# 배지가 가장 얇은 곳이 제주라 그쪽 흔들림이 화면에 더 크게 반영된다.
# 하루 3회 호출이라 일일 한도(OPEN_DECISIONS 15번)에 부담이 없다.
REGIONS = {
    'gyeongju': ('47', '47130'),
    'jeju': ('50', '50110'),
    'seogwipo': ('50', '50130'),
}


def service_key():
    cfg = io.open(os.path.join(ROOT, 'backend/src/main/resources/application-local.yml'),
                  encoding='utf-8').read()
    return re.search(r'service-key:\s*"([^"]+)"', cfg).group(1)


def fetch(key, area, signgu):
    url = ('https://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList'
           f'?serviceKey={key}&MobileOS=ETC&MobileApp=PEAKOFF&_type=json'
           f'&numOfRows=10000&pageNo=1&areaCd={area}&signguCd={signgu}')
    body = json.loads(urllib.request.urlopen(url, timeout=60).read().decode('utf-8'))['response']['body']
    items = (body.get('items') or {})
    items = items.get('item') if isinstance(items, dict) else None
    snap = {}
    for item in (items or []):
        snap.setdefault(item['tAtsNm'].strip(), {})[str(item['baseYmd']).strip()] = float(item['cnctrRate'])
    return snap


def snapshots_of(region):
    """그 지역의 저장된 스냅샷을 {찍은 날짜: 자료}로 모은다."""
    out = {}
    for f in sorted(os.listdir(HERE)):
        m = re.fullmatch(rf'{region}-(\d{{4}}-\d{{2}}-\d{{2}})\.json', f)
        if m:
            out[datetime.date.fromisoformat(m.group(1))] = json.load(
                io.open(os.path.join(HERE, f), encoding='utf-8'))
    return out


def compare(before, after):
    """겹치는 (장소, 날짜)만 맞댄다. 창이 하루씩 밀리므로 첫날은 빠지고 끝에 하루가 붙는다."""
    deltas = []
    for name, series in after.items():
        for date, value in series.items():
            old = before.get(name, {}).get(date)
            if old is not None:
                deltas.append((name, date, old, value))
    return deltas


def report_gap(region, taken_on, snaps):
    """① 간격이 벌어지면 바뀌는가 — 오늘치를 이전 스냅샷 전부와 맞댄다."""
    rows = []
    olds = sorted(d for d in snaps if d != taken_on)
    if not olds:
        print('  이전 스냅샷이 없다. 내일 다시 돌리면 그때 변화량이 나온다.')
        return rows
    print(f'  {"간격":>6s} {"기준일":>12s} {"겹친 쌍":>8s} {"바뀐 쌍":>16s} {"평균":>7s} {"중앙":>7s} {"최대":>7s}')
    for day in olds:
        gap = (taken_on - day).days
        deltas = compare(snaps[day], snaps[taken_on])
        if not deltas:
            print(f'  {gap:4d}일 {day.isoformat():>12s} {"겹치는 날짜 없음":>24s}')
            continue
        diffs = [abs(d[3] - d[2]) for d in deltas if abs(d[3] - d[2]) > 1e-9]
        ratio = len(diffs) / len(deltas)
        stat = (f'{st.mean(diffs):7.2f} {st.median(diffs):7.2f} {max(diffs):7.2f}'
                if diffs else f'{"—":>7s} {"—":>7s} {"—":>7s}')
        print(f'  {gap:4d}일 {day.isoformat():>12s} {len(deltas):8,d} '
              f'{len(diffs):7,d} ({ratio:5.1%}) {stat}')
        rows.append((taken_on.isoformat(), region, f'{gap}일', day.isoformat(),
                     f'{len(deltas):,}', f'{len(diffs):,}', f'{ratio:.1%}',
                     f'{st.mean(diffs):.2f}' if diffs else '—',
                     f'{st.median(diffs):.2f}' if diffs else '—',
                     f'{max(diffs):.2f}' if diffs else '—'))
    return rows


def report_horizon(region, taken_on, snaps):
    """② 방문일이 다가오면 바뀌는가 — 바뀐 값이 '며칠 뒤 날짜'였는지로 가른다.

    가장 그럴듯한 가설이다. 먼 미래는 손대지 않다가 방문일이 코앞이면
    최근 관측을 반영해 조정할 수 있다. 그렇다면 D-3짜리만 흔들린다.
    """
    olds = sorted(d for d in snaps if d != taken_on)
    if not olds:
        return
    prev = olds[-1]
    deltas = compare(snaps[prev], snaps[taken_on])
    buckets = {}
    for _, date, old, new in deltas:
        d = datetime.date.fromisoformat(f'{date[:4]}-{date[4:6]}-{date[6:]}')
        key = (d - taken_on).days // 7      # 0: 이번 주, 1: 다음 주 …
        hit, total = buckets.get(key, (0, 0))
        buckets[key] = (hit + (1 if abs(new - old) > 1e-9 else 0), total + 1)
    if not buckets:
        return
    print(f'  방문일까지 남은 기간별 변화율 ({prev.isoformat()} 대비)')
    for key in sorted(buckets):
        hit, total = buckets[key]
        print(f'    D+{key * 7:2d}~{key * 7 + 6:<2d}일   {hit:4d}/{total:5d}  ({hit / total:5.1%})')


def append_log(rows):
    """결과만 남긴다. 원자료 스냅샷은 하루 300KB라 커밋하지 않는다(.gitignore).

    스냅샷이 지워져도 "며칠 간격에서 얼마나 바뀌었나"는 이 파일에 남는다 —
    남겨야 하는 것은 원자료가 아니라 판단의 근거다.
    """
    path = os.path.join(HERE, 'DRIFT-LOG.md')
    if not os.path.exists(path):
        header = [
            '# 집중률 예측 흔들림 기록',
            '',
            '> `snapshot.py`가 돌 때마다 한 줄씩 붙인다. 원자료 스냅샷은 커밋하지 않는다(하루 300KB).',
            '> **바뀐 쌍이 0%로 이어지면** CLAUDE.md의 "같은 날짜 값도 갱신되며 바뀐다"를 지워야 한다.',
            '',
            '| 잰 날 | 지역 | 간격 | 기준일 | 겹친 쌍 | 바뀐 쌍 | 비율 | 평균 | 중앙 | 최대 |',
            '|---|---|--:|---|--:|--:|--:|--:|--:|--:|',
            '',
        ]
        io.open(path, 'w', encoding='utf-8').write('\n'.join(header))
    with io.open(path, 'a', encoding='utf-8') as f:
        for r in rows:
            f.write('| ' + ' | '.join(str(x) for x in r) + ' |\n')


def main():
    key = service_key()
    today = datetime.date.today()
    log_rows = []

    for region, (area, signgu) in REGIONS.items():
        path = os.path.join(HERE, f'{region}-{today.isoformat()}.json')
        if os.path.exists(path):
            print(f'[{region}] 오늘치가 이미 있다. 호출하지 않는다.')
        else:
            snap = fetch(key, area, signgu)
            io.open(path, 'w', encoding='utf-8').write(
                json.dumps(snap, ensure_ascii=False, sort_keys=True))
            print(f'[{region}] 관광지 {len(snap)}곳 저장 → {os.path.basename(path)}')

        snaps = snapshots_of(region)
        if today not in snaps:
            continue
        log_rows += report_gap(region, today, snaps) or []
        report_horizon(region, today, snaps)
        print()

    if log_rows:
        append_log(log_rows)
        print(f'DRIFT-LOG.md에 {len(log_rows)}줄 기록했다.')


if __name__ == '__main__':
    main()
