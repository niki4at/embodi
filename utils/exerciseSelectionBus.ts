// Lightweight in-process bridge so the exercise detail route (a separate
// screen) can toggle selection back in whatever picker opened it — without
// threading callbacks through navigation params. The opener registers a
// handler while mounted; the detail screen emits the user's pick.

export type LibraryPick = {
  id: string
  name: string
  bodyPart: string
  modality: string
  equipment: string
}

type Handler = (pick: LibraryPick) => void

let handler: Handler | null = null

export function setSelectionHandler(next: Handler | null): void {
  handler = next
}

export function emitSelectionToggle(pick: LibraryPick): void {
  handler?.(pick)
}
