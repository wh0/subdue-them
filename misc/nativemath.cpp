#include <algorithm>
#include <cmath>
#include <iomanip>
#include <iostream>
#include <iterator>
#include <random>
#include <vector>

const int start_score = 2;

int sim(std::vector<int> &a, std::vector<int> &p) {
  int score = start_score;
  size_t i = 0;
  size_t j = 0;
  while (true) {
    if (i < a.size() && score > a[i]) {
      score += a[i++];
    } else if (j < p.size()) {
      score *= p[j++];
    } else {
      break;
    }
  }
  return score;
}

struct OptResult {
  int b, bb;
  std::vector<int> bp, bbp;
};

OptResult opt(std::vector<int> &a, std::vector<int> &m) {
  OptResult res{};
  do {
    int s = sim(a, m);
    if (s > res.b) {
      res.bb = res.b;
      res.bbp.swap(res.bp);
      res.b = s;
      res.bp = m;
    }
  } while (std::next_permutation(m.begin(), m.end()));
  return res;
}

int rand_round(std::mt19937 &re, int min_inc, int max_inc) {
  int common_zeros = 0;
  int lo = min_inc;
  int hi = max_inc;
  while (lo > 99) {
    int lo_div = (lo + 9) / 10;
    int hi_div = hi / 10;
    if (lo_div >= hi_div) break;
    lo = lo_div;
    hi = hi_div;
    common_zeros++;
  }
  if (lo > 99) {
    int r = std::uniform_int_distribution<int>(lo, hi)(re);
    int exp = 1;
    for (int i = 0; i < common_zeros; i++) {
      exp *= 10;
    }
    return r * exp;
  }
  int lo_zeros = common_zeros;
  int hi_zeros = common_zeros;
  while (hi > 99) {
    hi = hi / 10;
    hi_zeros += 1;
  }
  lo += 90 * lo_zeros;
  hi += 90 * hi_zeros;
  int r = std::uniform_int_distribution<int>(lo, hi)(re);
  int exp = 1;
  while (r > 99) {
    r -= 90;
    exp *= 10;
  }
  return r * exp;
}

int main(int argc, char **argv) {
  std::vector<int> a{};
  a.reserve(10);
  std::vector<int> m{2, 3, 4, 5, 6, 7, 8, 9, 10};

  std::random_device rd;
  auto seed = rd();
  std::cout << "seed " << seed << std::endl;
  std::mt19937 re(seed);
  for (int i = 0; i < 9; i++) {
    std::cout << "i " << i << std::flush;
    // std::cout << "a ";
    // std::copy(a.begin(), a.end(), std::ostream_iterator<int>(std::cout, " "));
    // std::cout << std::endl;
    OptResult res = opt(a, m);
    std::cout << " s " << std::setw(10) << res.b;
    // int v = std::round(std::exp(std::uniform_real_distribution<double>(0, std::log(res.b - 1))(re)));
    int v = rand_round(re, 1, res.b - 1);
    std::cout << " v " << std::setw(10) << v << std::endl;
    a.push_back(v);
    std::sort(a.begin(), a.end());
  }
  // std::cout << "boss" << std::endl;
  // std::cout << "a ";
  // std::copy(a.begin(), a.end(), std::ostream_iterator<int>(std::cout, " "));
  // std::cout << std::endl;
  // std::cout << "m ";
  // std::copy(m.begin(), m.end(), std::ostream_iterator<int>(std::cout, " "));
  // std::cout << std::endl;
  OptResult res = opt(a, m);
  std::cout << "b     " << std::setw(10) << res.b  << " bp  ";
  std::copy(res.bp.begin(), res.bp.end(), std::ostream_iterator<int>(std::cout, " "));
  std::cout << std::endl;
  std::cout << "bb    " << std::setw(10) << res.bb << " bbp ";
  std::copy(res.bbp.begin(), res.bbp.end(), std::ostream_iterator<int>(std::cout, " "));
  std::cout << std::endl;
  int boss_v = rand_round(re, res.bb, res.b - 1);
  std::cout << "v     " << std::setw(10) << boss_v << std::endl;

  for (const int &f : m) {
    std::cout << "    {type: 'mul', f: " << f << "}," << std::endl;
  }
  std::cout << "    // seed " << seed << std::endl;
  for (const int &v : a) {
    std::cout << "    {type: 'add', v: " << v << "}," << std::endl;
  }
  std::cout << "    {type: 'add', v: " << boss_v << ", boss: true}," << std::endl;

  return 0;
}
