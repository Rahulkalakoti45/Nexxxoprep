/** Whole minutes, or "<1 min" for anything shorter, so a 28-second interview never reads "0 min". */
export function formatMinutes(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  return total < 60 ? '<1 min' : `${Math.round(total / 60)} min`
}
