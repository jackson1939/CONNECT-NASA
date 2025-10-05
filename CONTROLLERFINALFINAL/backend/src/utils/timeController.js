    // utils/timeController.js
export function getDateRange(daysBack = 7) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - daysBack);

  const format = (d) =>
    d.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD

  return {
    start: format(start),
    end: format(end),
  };
}
