// localStorage that never takes the game down: a private window, a full quota or blocked site
// data make every call fail softly — reads fall back, writes report false — so saving stays a
// convenience and the session always runs.

/** Parse the stored text (null when absent) with `parse`; any failure returns `fallback`. */
export function readStored<T>(key: string, parse: (text: string | null) => T, fallback: T): T {
  try {
    return parse(localStorage.getItem(key))
  } catch {
    return fallback
  }
}

/** Store the text; false when storage is unavailable. */
export function writeStored(key: string, text: string): boolean {
  try {
    localStorage.setItem(key, text)
    return true
  } catch {
    return false
  }
}

/** Remove the key; false when storage is unavailable. */
export function removeStored(key: string): boolean {
  try {
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}
