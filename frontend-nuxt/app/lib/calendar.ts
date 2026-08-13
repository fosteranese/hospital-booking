interface CalendarEvent {
  title: string
  description: string
  location: string
  startDate: string
  startTime: string
  endTime: string
}

function toIcsDatetime(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  const [hh, mm] = time.split(':').map(Number) as [number, number]
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`
}

export function generateIcsContent(event: CalendarEvent): string {
  const dtStart = toIcsDatetime(event.startDate, event.startTime)
  const dtEnd = toIcsDatetime(event.startDate, event.endTime)
  const escaped = (s: string) => s.replace(/[,;\\]/g, (c) => '\\' + c).replace(/\n/g, '\\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HospitalBooking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'DTSTART:' + dtStart,
    'DTEND:' + dtEnd,
    'SUMMARY:' + escaped(event.title),
    'DESCRIPTION:' + escaped(event.description),
    'LOCATION:' + escaped(event.location),
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n')
}

export function downloadIcs(event: CalendarEvent, filename = 'appointment.ics') {
  const content = generateIcsContent(event)
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function getGoogleCalendarUrl(event: CalendarEvent): string {
  const dtStart = toIcsDatetime(event.startDate, event.startTime)
  const dtEnd = toIcsDatetime(event.startDate, event.endTime)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${dtStart}/${dtEnd}`,
    details: event.description,
    location: event.location,
  })
  return `https://www.google.com/calendar/render?${params.toString()}`
}

export function getOutlookUrl(event: CalendarEvent): string {
  const dtStart = toIcsDatetime(event.startDate, event.startTime)
  const dtEnd = toIcsDatetime(event.startDate, event.endTime)
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    startdt: dtStart,
    enddt: dtEnd,
    subject: event.title,
    body: event.description,
    location: event.location,
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}
