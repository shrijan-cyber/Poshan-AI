const INDIA_OFFSET_MINUTES = 5 * 60 + 30;

export function makeSlotDateTime(date, timeSlot) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = timeSlot.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - INDIA_OFFSET_MINUTES * 60_000);
}

export function getIndiaSlotParts(dateTime) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(dateTime);
  const values = Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    timeSlot: `${values.hour}:${values.minute}`,
  };
}

export default { makeSlotDateTime, getIndiaSlotParts };
