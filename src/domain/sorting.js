export function mergeSort(items, compare) {
  if (!Array.isArray(items) || typeof compare !== 'function') {
    throw new TypeError('mergeSort requires an array and comparator');
  }

  function merge(left, right) {
    const result = [];
    let leftIndex = 0;
    let rightIndex = 0;
    while (leftIndex < left.length && rightIndex < right.length) {
      if (compare(left[leftIndex], right[rightIndex]) <= 0) {
        result.push(left[leftIndex]);
        leftIndex += 1;
      } else {
        result.push(right[rightIndex]);
        rightIndex += 1;
      }
    }
    return result.concat(left.slice(leftIndex), right.slice(rightIndex));
  }

  function sort(values) {
    if (values.length < 2) return values.slice();
    const middle = Math.floor(values.length / 2);
    return merge(sort(values.slice(0, middle)), sort(values.slice(middle)));
  }

  return sort(items);
}
