import functools
import itertools
import math
import random

start_score = 2

def sim_n(a, p):
  score = start_score
  i = 0
  j = 0
  while True:
    if i < len(a) and a[i] < score:
      score += a[i]
      i += 1
    elif j < len(p):
      score *= p[j]
      j += 1
    else:
      break
  return score

def sim(a, p):
  score = start_score
  i = 0
  j = 0
  h = []
  while True:
    if i < len(a) and a[i] < score:
      h.append('+%d' % a[i])
      score += a[i]
      i += 1
    elif j < len(p):
      h.append('x%d' % p[j])
      score *= p[j]
      j += 1
    else:
      break
  return (score, h)

def opt(a, m, r):
  return functools.reduce(max, (sim_n(a, p) for p in itertools.permutations(m, r)))

def top2(a, m):
  b = (start_score, [])
  bb = b
  for p in itertools.permutations(m):
    s, h = sim(a, p)
    if s > b[0]:
      bb = b
      b = (s, h)
  return b, bb

def t():
  a = []
  # d = [0, 2, 6, None, None, None, None, None, None][]
  d = [None, None, None, None, None, None, None, None, None]
  m = list(range(2, 11))
  for i in range(9):
    print('i', i)
    s = opt(a, m, d[i])
    print('s', s)
    v = round(math.exp(random.uniform(0, math.log(s - 1))))
    if v >= s:
      v = s - 1
    print('v', v)
    a.append(v)
    a.sort()
  print('a', a)
  print('m', m)
  print('top2', top2(a, m))

t()
