/** Timestamps are stored in UTC; the dashboard always shows them in the owner's zone (SPEC §3). */
export const DISPLAY_TIME_ZONE = 'America/Argentina/Buenos_Aires'

const dateTime = new Intl.DateTimeFormat('es-AR', {
  timeZone: DISPLAY_TIME_ZONE,
  dateStyle: 'short',
  timeStyle: 'medium',
})

export const formatDateTime = (isoUtc: string): string => dateTime.format(new Date(isoUtc))
