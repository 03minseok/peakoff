# -*- coding: utf-8 -*-
"""경계 후보를 전국·서비스지역 양쪽에서 동시에 본다."""
import io, json, os, statistics as st
from collections import Counter
HERE=os.path.dirname(os.path.abspath(__file__)); SNAP=os.path.join(HERE,'snapshots')
regs=[(json.load(io.open(os.path.join(SNAP,f),encoding='utf-8'))) for f in sorted(os.listdir(SNAP))]
regs=[(d['meta'],d['data']) for d in regs]
NAME={'47130':'경주','50110':'제주시','50130':'서귀포'}
def qs(pred): return sorted(100-v for m,d in regs if pred(m) for s in d.values() for v in s.values())
nat=qs(lambda m:True); svc=qs(lambda m:m['signgu'] in NAME)
per={NAME[c]:qs(lambda m,c=c:m['signgu']==c) for c in NAME}

def sp(a,hi,lo):
    c=Counter('한적' if x>=hi else ('보통' if x>=lo else '붐빔') for x in a); n=len(a)
    return f'{c["한적"]/n:5.1%}/{c["보통"]/n:5.1%}/{c["붐빔"]/n:5.1%}'

print(f'{"경계":>9s} │ {"전국 표본":^21s} │ {"서비스 3지역":^21s} │ {"경주":^21s} │ {"제주시":^21s} │ {"서귀포":^21s}')
print(f'{"":9s} │ {"한적/보통/붐빔":^19s} │ {"한적/보통/붐빔":^19s} │ {"한적/보통/붐빔":^19s} │ {"한적/보통/붐빔":^19s} │ {"한적/보통/붐빔":^19s}')
print('─'*128)
for hi,lo,note in [(70,40,'지금'),(73,37,'전국 1·3분위'),(65,35,''),(63,30,'서비스 1·3분위'),(60,35,'')]:
    print(f'{hi:3d}/{lo:<3d}  │ {sp(nat,hi,lo)} │ {sp(svc,hi,lo)} │ '
          + ' │ '.join(sp(per[k],hi,lo) for k in ('경주','제주시','서귀포')) + f'  {note}')

print()
print('── 배지가 30일 내내 고정인 관광지 비율')
for hi,lo in [(70,40),(73,37),(65,35),(63,30)]:
    row=[]
    for lbl,pred in [('전국',lambda m:True),('경주',lambda m:m['signgu']=='47130'),
                     ('제주시',lambda m:m['signgu']=='50110'),('서귀포',lambda m:m['signgu']=='50130')]:
        t=k=0
        for m,d in regs:
            if not pred(m): continue
            for s in d.values():
                t+=1
                if len({('한적' if 100-v>=hi else ('보통' if 100-v>=lo else '붐빔')) for v in s.values()})==1: k+=1
        row.append(f'{lbl} {k/t:5.1%}')
    print(f'  {hi}/{lo:<3d} → ' + ' · '.join(row))
