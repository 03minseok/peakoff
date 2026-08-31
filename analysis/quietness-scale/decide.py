# -*- coding: utf-8 -*-
"""1번(변환식 해석)·2번(경계) 판단 근거."""
import io, json, os, datetime, statistics as st
from collections import Counter
HERE = os.path.dirname(os.path.abspath(__file__))
F = {'경주': os.path.join(HERE,'..','forecast-drift','gyeongju-2026-08-30.json'),
     '제주시': os.path.join(HERE,'jeju-2026-08-30.json'),
     '서귀포': os.path.join(HERE,'seogwipo-2026-08-30.json')}
data = {r: json.load(io.open(p, encoding='utf-8')) for r,p in F.items()}
allv = [v for d in data.values() for s in d.values() for v in s.values()]

print('='*76); print('D. cnctrRate는 장소 안에서 정규화된 값인가? (1번의 전제)'); print('='*76)
for r,d in data.items():
    sums = [sum(s.values()) for s in d.values() if len(s)==30]
    print(f'{r:6s} 장소별 30일 합계  {min(sums):6.0f} ~ {max(sums):6.0f}   중앙 {st.median(sums):6.0f}  (변동계수 {st.pstdev(sums)/st.mean(sums):.2f})')
print('→ 합계가 장소마다 3배 넘게 벌어지면 "장소 안에서 100%로 나눈 값"이 아니다 = 장소 간 비교가 성립한다')

print(); print('='*76); print('E. 경계 후보별 3단계 비율 (전체 15,510 · 한적도=100-집중률)'); print('='*76)
qs = sorted(100-v for v in allv)
def split(hi, lo):
    c = Counter('한적' if x>=hi else ('보통' if x>=lo else '붐빔') for x in qs)
    n = len(qs); return tuple(c[k]/n for k in ('한적','보통','붐빔'))
def pct(f): return qs[int(len(qs)*f)]
print(f'{"경계":>12s} {"한적":>8s} {"보통":>8s} {"붐빔":>8s}   비고')
for hi,lo,note in [(70,40,'지금'),(65,40,''),(63,37,'3등분(실측 33·67분위)'),(60,40,''),(60,35,''),(55,35,'')]:
    a,b,c = split(hi,lo)
    print(f'{hi:5d} / {lo:<4d}   {a:7.1%} {b:7.1%} {c:7.1%}   {note}')
print(f'\n참고 — 한적도 분위수: p25 {pct(.25):.0f} · p33 {pct(1/3):.0f} · 중앙 {pct(.5):.0f} · p67 {pct(2/3):.0f} · p75 {pct(.75):.0f}')

print(); print('='*76); print('F. 경계를 옮기면 지역별로 어떻게 갈리나'); print('='*76)
for hi,lo in [(70,40),(63,37),(60,35)]:
    print(f'\n── 경계 {hi}/{lo}')
    for r,d in data.items():
        q = [100-v for s in d.values() for v in s.values()]
        c = Counter('한적' if x>=hi else ('보통' if x>=lo else '붐빔') for x in q); n=len(q)
        kinds = Counter(len({('한적' if 100-v>=hi else ('보통' if 100-v>=lo else '붐빔')) for v in s.values()}) for s in d.values())
        print(f'   {r:6s} 한적 {c["한적"]/n:5.1%} · 보통 {c["보통"]/n:5.1%} · 붐빔 {c["붐빔"]/n:5.1%}'
              f'   │ 30일간 배지 한 종류뿐인 장소 {kinds[1]}/{len(d)}곳')

print(); print('='*76); print('G. 요일 효과 — 배지가 "주중에 가라"를 말할 수 있나'); print('='*76)
W='월화수목금토일'
for r,d in data.items():
    by={}
    for s in d.values():
        for dt,v in s.items():
            w=datetime.date(int(dt[:4]),int(dt[4:6]),int(dt[6:])).weekday()
            by.setdefault(w,[]).append(100-v)
    print(f'{r:6s} ' + '  '.join(f'{W[w]} {st.mean(by[w]):4.1f}' for w in range(7)))
