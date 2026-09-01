# -*- coding: utf-8 -*-
"""안 쓰인 집중률 이름에 짝이 될 만한 카탈로그 장소를 찾아 제안한다.

<h3>변형을 펼쳐서 견준다</h3>
두 API가 같은 곳을 <b>괄호를 뒤집어</b> 부르는 일이 잦다:

    집중률   "함덕 서우봉 해변 (함덕해수욕장)"
    관광정보 "함덕해수욕장 (함덕 서우봉 해변)"

괄호를 떼고 비교하면 "함덕서우봉해변" vs "함덕해수욕장"이라 안 걸린다.
괄호 <b>안</b>도 하나의 이름으로 보고 모든 짝을 견주면 바로 잡힌다.

⚠️ <b>제안일 뿐이다.</b> 잘못 이으면 다른 장소의 혼잡도를 그 장소의 것이라고 말하게 되므로
   사람이 한 줄씩 보고 정한다.
"""
import io, json, os, re, difflib
HERE=os.path.dirname(os.path.abspath(__file__))
d=json.load(io.open(os.path.join(HERE,'sweep.json'),encoding='utf-8'))
STOP=re.compile(r'^(경주|제주|서귀포|여수|속초|태안|춘천)\s*')

def variants(s):
    """원문 · 괄호 밖 · 괄호 안 · 지자체명 뗀 것 — 전부 후보로 본다."""
    out=set()
    raw=s.strip()
    inner=re.findall(r'[\(\[]([^)\]]*)[)\]]', raw)
    outer=re.sub(r'[\(\[][^)\]]*[)\]]','',raw)
    for v in [raw, outer, *inner]:
        for piece in re.split(r'[,/]', v):
            p=re.sub(r'\s+','',piece).strip()
            if len(p)>=2: out.add(p)
            q=re.sub(r'\s+','',STOP.sub('',piece.strip()))
            if len(q)>=2: out.add(q)
    return out

def score(a,b,generic):
    """generic: 여러 장소가 나눠 쓰는 조각. 이걸로는 잇지 않는다.

    "경북 동해안 국가지질공원"처럼 <b>공원·권역 이름이 괄호에 붙는</b> 표기가 흔한데,
    그것만 같다고 이으면 <b>양남 주상절리군이 골굴암 타포니가 된다</b>(실제로 만점이 나왔다).
    """
    best=0.0
    for x in variants(a):
        if x in generic: continue
        for y in variants(b):
            if y in generic: continue
            if x==y: return 1.0
            if (x in y or y in x) and min(len(x),len(y))>=3: best=max(best,0.9)
            best=max(best,difflib.SequenceMatcher(None,x,y).ratio())
    return best

total=0; strong=0
for slug,r in d.items():
    miss=[m['name'] for m in r['missing']]
    # 두 곳 이상이 나눠 쓰는 조각은 이름이 아니라 꼬리표다(공원명·권역명).
    # 진짜 장소 이름이라면 그 지역에서 하나뿐이어야 한다.
    from collections import Counter
    freq=Counter()
    for n in miss: freq.update(variants(n))
    generic={v for v,c in freq.items() if c>=2}
    print(f"\n{'='*80}\n[{r['label']}] 안 쓰인 집중률 이름 {len(r['unused'])}개\n{'='*80}")
    for f in r['unused']:
        total+=1
        best=sorted(((score(f,n,generic),n) for n in miss), reverse=True)[:3]
        best=[(s,n) for s,n in best if s>=0.6]
        if not best:
            print(f'  ✗  {f:32s} → 짝 후보 없음')
            continue
        clear = best[0][0]>=0.9 and (len(best)==1 or best[0][0]-best[1][0]>=0.05)
        if clear: strong+=1
        print(f'  {"★" if clear else "?"}  {f:32s} → ' + ' | '.join(f'{n} ({s:.2f})' for s,n in best))
print(f'\n총 {total}개 중 확실한 짝 {strong}개')
