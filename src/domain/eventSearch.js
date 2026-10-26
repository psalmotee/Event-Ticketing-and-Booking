import { DomainError } from './errors.js';
import { mergeSort } from './sorting.js';

function validDate(value, name) {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)
    || Number.isNaN(Date.parse(value))) {
    throw new DomainError('VALIDATION', `${name} must be a valid date`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day) {
      throw new DomainError('VALIDATION', `${name} must be a valid date`);
    }
  }
  return value;
}

function validPrice(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new DomainError('VALIDATION', 'maxPriceCents must be a whole number');
  }
}

function cheapest(summary) {
  if (!summary.tiers?.length) return undefined;
  return Math.min(...summary.tiers.map((tier) => tier.priceCents));
}

function available(summary) {
  return (summary.tiers ?? []).reduce((total, tier) => total + tier.available, 0);
}

export function filterEvents(summaries, criteria = {}) {
  const { q, city, from, to, maxPriceCents, onlyAvailable } = criteria;
  if (from !== undefined) validDate(from, 'from');
  if (to !== undefined) validDate(to, 'to');
  if (maxPriceCents !== undefined) validPrice(maxPriceCents);
  const query = q === undefined ? undefined : String(q).toLocaleLowerCase();
  const expectedCity = city === undefined ? undefined : String(city).toLocaleLowerCase();
  const fromTime = from === undefined ? undefined : Date.parse(from);
  const toTime = to === undefined ? undefined
    : Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59.999Z` : to);

  return summaries.filter((summary) => {
    const title = String(summary.title ?? summary.name ?? '');
    const venue = String(summary.venue ?? '');
    if (query !== undefined
      && !title.toLocaleLowerCase().includes(query)
      && !venue.toLocaleLowerCase().includes(query)) return false;
    if (expectedCity !== undefined
      && String(summary.city ?? '').toLocaleLowerCase() !== expectedCity) return false;
    const eventTime = Date.parse(summary.date);
    if (fromTime !== undefined && eventTime < fromTime) return false;
    if (toTime !== undefined && eventTime > toTime) return false;
    if (maxPriceCents !== undefined) {
      const price = cheapest(summary);
      if (price === undefined || price > maxPriceCents) return false;
    }
    if (onlyAvailable === true && available(summary) <= 0) return false;
    return true;
  });
}

export function sortEvents(summaries, sortBy) {
  if (!['date', 'price', 'availability'].includes(sortBy)) {
    throw new DomainError('VALIDATION', `Unknown sort option: ${sortBy}`);
  }
  return mergeSort(summaries, (left, right) => {
    let result;
    if (sortBy === 'date') result = Date.parse(left.date) - Date.parse(right.date);
    if (sortBy === 'price') {
      const leftPrice = cheapest(left);
      const rightPrice = cheapest(right);
      if (leftPrice === undefined && rightPrice === undefined) result = 0;
      else if (leftPrice === undefined) result = 1;
      else if (rightPrice === undefined) result = -1;
      else result = leftPrice - rightPrice;
    }
    if (sortBy === 'availability') result = available(right) - available(left);
    if (result !== 0) return result;
    const titleResult = String(left.title ?? left.name ?? '').localeCompare(
      String(right.title ?? right.name ?? ''),
    );
    return titleResult !== 0 ? titleResult : String(left.id).localeCompare(String(right.id));
  });
}

export function searchEvents(summaries, criteria, sortBy) {
  return sortEvents(filterEvents(summaries, criteria), sortBy);
}
