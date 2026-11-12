/**
 * Coding interview problems. Each problem is a function the candidate implements; tests call it
 * with `args` and compare the result to `expected`. Hidden tests are only reported as pass/fail
 * counts, like a real online assessment. `build` creates large inputs at run time so the bank
 * stays small. `compare: 'unordered'` accepts the top-level array in any order.
 */

const range = (n) => Array.from({ length: n }, (_, i) => i)

export const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
]

export const PROBLEMS = [
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Easy',
    topics: ['Arrays', 'Hash map'],
    prompt:
      'Given an array of integers `nums` and an integer `target`, return the indices of the two numbers that add up to `target`.\n\nEach input has exactly one solution, and you may not use the same element twice. Return the two indices in any order.',
    examples: [
      { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'nums[0] + nums[1] = 2 + 7 = 9' },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
    ],
    constraints: ['2 ≤ nums.length ≤ 10⁴', '-10⁹ ≤ nums[i], target ≤ 10⁹', 'Exactly one valid answer exists'],
    functionName: { javascript: 'twoSum', python: 'two_sum' },
    starter: {
      javascript: 'function twoSum(nums, target) {\n  // Return [i, j] such that nums[i] + nums[j] === target\n\n}\n',
      python: 'def two_sum(nums, target):\n    # Return [i, j] such that nums[i] + nums[j] == target\n    pass\n',
    },
    compare: 'unordered',
    tests: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
      { args: [[3, 3], 6], expected: [0, 1] },
      { args: [[1, 5, 3, 8], 11], expected: [2, 3], hidden: true },
      { args: [[-3, 4, 3, 90], 0], expected: [0, 2], hidden: true },
      { build: () => [range(10000), 19997], expected: [9998, 9999], hidden: true, label: 'Large input (10,000 numbers)' },
    ],
    expectedComplexity: { time: 'O(n)', space: 'O(n)' },
    hints: [
      'For each number, what other number would you need to reach the target?',
      'Can you look that number up in constant time instead of scanning the array again?',
      'Store each number’s index in a hash map as you go, and check the map for target − num before inserting.',
    ],
    followUps: ['What if the array were sorted? Could you use less memory?', 'What if there could be many valid pairs?'],
  },
  {
    id: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'Easy',
    topics: ['Stack', 'Strings'],
    prompt:
      'Given a string `s` containing only the characters `()[]{}`, decide whether it is valid.\n\nA string is valid when every opening bracket is closed by the same type of bracket, and brackets close in the correct order.',
    examples: [
      { input: 's = "()[]{}"', output: 'true' },
      { input: 's = "(]"', output: 'false' },
      { input: 's = "{[]}"', output: 'true' },
    ],
    constraints: ['0 ≤ s.length ≤ 10⁴', 's contains only ()[]{}'],
    functionName: { javascript: 'isValid', python: 'is_valid' },
    starter: {
      javascript: 'function isValid(s) {\n\n}\n',
      python: 'def is_valid(s):\n    pass\n',
    },
    tests: [
      { args: ['()'], expected: true },
      { args: ['()[]{}'], expected: true },
      { args: ['(]'], expected: false },
      { args: ['([)]'], expected: false, hidden: true },
      { args: ['{[]}'], expected: true, hidden: true },
      { args: [''], expected: true, hidden: true },
      { args: ['(('], expected: false, hidden: true },
      { args: ['){'], expected: false, hidden: true },
    ],
    expectedComplexity: { time: 'O(n)', space: 'O(n)' },
    hints: [
      'The most recent opening bracket has to be closed first. Which data structure gives you “most recent first”?',
      'Push opening brackets onto a stack; on a closing bracket, check the top of the stack.',
      'Don’t forget the cases where the stack is empty when you see a closer, or not empty at the end.',
    ],
    followUps: ['How would you also report the position of the first invalid bracket?'],
  },
  {
    id: 'merge-intervals',
    title: 'Merge Intervals',
    difficulty: 'Medium',
    topics: ['Sorting', 'Intervals'],
    prompt:
      'Given an array of `intervals` where `intervals[i] = [start, end]`, merge all overlapping intervals and return the merged list, sorted by start.\n\nIntervals that touch (e.g. [1,4] and [4,5]) count as overlapping.',
    examples: [
      { input: 'intervals = [[1,3],[2,6],[8,10],[15,18]]', output: '[[1,6],[8,10],[15,18]]', explanation: '[1,3] and [2,6] overlap, so they become [1,6].' },
      { input: 'intervals = [[1,4],[4,5]]', output: '[[1,5]]' },
    ],
    constraints: ['1 ≤ intervals.length ≤ 10⁴', '0 ≤ start ≤ end ≤ 10⁴', 'Input may not be sorted'],
    functionName: { javascript: 'merge', python: 'merge' },
    starter: {
      javascript: 'function merge(intervals) {\n\n}\n',
      python: 'def merge(intervals):\n    pass\n',
    },
    tests: [
      { args: [[[1, 3], [2, 6], [8, 10], [15, 18]]], expected: [[1, 6], [8, 10], [15, 18]] },
      { args: [[[1, 4], [4, 5]]], expected: [[1, 5]] },
      { args: [[[8, 10], [1, 3], [2, 6]]], expected: [[1, 6], [8, 10]], hidden: true, label: 'Unsorted input' },
      { args: [[[1, 4], [2, 3]]], expected: [[1, 4]], hidden: true, label: 'Interval fully inside another' },
      { args: [[[5, 5]]], expected: [[5, 5]], hidden: true },
      { build: () => [range(5000).map((i) => [i * 2, i * 2 + 2])], expected: [[0, 10000]], hidden: true, label: 'Large chain (5,000 intervals)' },
    ],
    expectedComplexity: { time: 'O(n log n)', space: 'O(n)' },
    hints: [
      'Would it be easier if the intervals were in order?',
      'After sorting by start, an interval overlaps the previous merged one exactly when its start ≤ the previous end.',
      'When they overlap, extend the previous end to max(prevEnd, currentEnd); otherwise start a new interval.',
    ],
    followUps: ['How would you insert one new interval into an already-merged list?'],
  },
  {
    id: 'longest-substring',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'Medium',
    topics: ['Sliding window', 'Hash map', 'Strings'],
    prompt: 'Given a string `s`, return the length of the longest substring that contains no repeated characters.',
    examples: [
      { input: 's = "abcabcbb"', output: '3', explanation: '"abc" is the longest such substring.' },
      { input: 's = "bbbbb"', output: '1' },
      { input: 's = "pwwkew"', output: '3', explanation: '"wke". Note "pwke" is a subsequence, not a substring.' },
    ],
    constraints: ['0 ≤ s.length ≤ 5 × 10⁴', 's has letters, digits, symbols and spaces'],
    functionName: { javascript: 'lengthOfLongestSubstring', python: 'length_of_longest_substring' },
    starter: {
      javascript: 'function lengthOfLongestSubstring(s) {\n\n}\n',
      python: 'def length_of_longest_substring(s):\n    pass\n',
    },
    tests: [
      { args: ['abcabcbb'], expected: 3 },
      { args: ['bbbbb'], expected: 1 },
      { args: ['pwwkew'], expected: 3 },
      { args: [''], expected: 0, hidden: true, label: 'Empty string' },
      { args: [' '], expected: 1, hidden: true },
      { args: ['dvdf'], expected: 3, hidden: true },
      { args: ['abba'], expected: 2, hidden: true, label: 'Window must never move left' },
      { build: () => ['abcdefghijklmnopqrstuvwxyz'.repeat(2000)], expected: 26, hidden: true, label: 'Large input (52,000 chars)' },
    ],
    expectedComplexity: { time: 'O(n)', space: 'O(min(n, charset))' },
    hints: [
      'Checking every substring is O(n²) or worse. Can you keep a “window” that is always valid?',
      'Move the right edge forward; when you hit a repeat, move the left edge just past the previous occurrence.',
      'Store the last index of each character in a map. Careful: the left edge must never move backwards.',
    ],
    followUps: ['What if you had to return the substring itself, not just its length?'],
  },
  {
    id: 'top-k-frequent',
    title: 'Top K Frequent Elements',
    difficulty: 'Medium',
    topics: ['Hash map', 'Heap', 'Bucket sort'],
    prompt: 'Given an integer array `nums` and an integer `k`, return the `k` most frequent elements, in any order.\n\nThe answer is guaranteed to be unique.',
    examples: [
      { input: 'nums = [1,1,1,2,2,3], k = 2', output: '[1,2]' },
      { input: 'nums = [1], k = 1', output: '[1]' },
    ],
    constraints: ['1 ≤ nums.length ≤ 10⁵', '1 ≤ k ≤ number of distinct elements', 'The answer is unique'],
    functionName: { javascript: 'topKFrequent', python: 'top_k_frequent' },
    starter: {
      javascript: 'function topKFrequent(nums, k) {\n\n}\n',
      python: 'def top_k_frequent(nums, k):\n    pass\n',
    },
    compare: 'unordered',
    tests: [
      { args: [[1, 1, 1, 2, 2, 3], 2], expected: [1, 2] },
      { args: [[1], 1], expected: [1] },
      { args: [[4, 4, 4, 6, 6, 7, 7, 7, 7], 2], expected: [7, 4], hidden: true },
      { args: [[5, 3, 5, 3, 9], 2], expected: [5, 3], hidden: true },
      { args: [[-1, -1, 2], 1], expected: [-1], hidden: true, label: 'Negative numbers' },
      { build: () => [[...range(50000).map((i) => i % 1000), ...Array(100).fill(7)], 1], expected: [7], hidden: true, label: 'Large input (50,100 numbers)' },
    ],
    expectedComplexity: { time: 'O(n log k) or O(n)', space: 'O(n)' },
    hints: [
      'Start by counting how often each number appears.',
      'Sorting all counts works in O(n log n). Can a heap of size k do better?',
      'Bucket sort: index buckets by frequency (at most n), then read from the highest bucket down.',
    ],
    followUps: ['How would this change if the numbers arrived as an endless stream?'],
  },
  {
    id: 'product-except-self',
    title: 'Product of Array Except Self',
    difficulty: 'Medium',
    topics: ['Arrays', 'Prefix sums'],
    prompt:
      'Given an integer array `nums`, return an array `answer` where `answer[i]` is the product of every element of `nums` except `nums[i]`.\n\nSolve it in O(n) time without using division.',
    examples: [
      { input: 'nums = [1,2,3,4]', output: '[24,12,8,6]' },
      { input: 'nums = [-1,1,0,-3,3]', output: '[0,0,9,0,0]' },
    ],
    constraints: ['2 ≤ nums.length ≤ 10⁵', '-30 ≤ nums[i] ≤ 30', 'No division'],
    functionName: { javascript: 'productExceptSelf', python: 'product_except_self' },
    starter: {
      javascript: 'function productExceptSelf(nums) {\n\n}\n',
      python: 'def product_except_self(nums):\n    pass\n',
    },
    tests: [
      { args: [[1, 2, 3, 4]], expected: [24, 12, 8, 6] },
      { args: [[-1, 1, 0, -3, 3]], expected: [0, 0, 9, 0, 0] },
      { args: [[2, 3]], expected: [3, 2], hidden: true },
      { args: [[0, 0]], expected: [0, 0], hidden: true, label: 'Two zeros' },
      { args: [[1, 0, 2]], expected: [0, 2, 0], hidden: true, label: 'One zero' },
      { build: () => [Array(20000).fill(1)], expected: Array(20000).fill(1), hidden: true, label: 'Large input (20,000 numbers)' },
    ],
    expectedComplexity: { time: 'O(n)', space: 'O(1) extra' },
    hints: [
      'answer[i] = (product of everything left of i) × (product of everything right of i).',
      'One pass left-to-right can fill in the left products; a second pass right-to-left can multiply in the right products.',
      'Use the output array itself for the left products and a single running variable for the right, for O(1) extra space.',
    ],
    followUps: ['How would you handle it if division were allowed but the array could contain zeros?'],
  },
]

export function getProblem(id) {
  return PROBLEMS.find((p) => p.id === id) || null
}
