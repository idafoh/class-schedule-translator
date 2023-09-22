const core = require('@actions/core')
const ics = require('ics')
const ical = require('node-ical')
const { Translate } = require('@google-cloud/translate').v2

function calculateDuration(start, end) {
  const timeDifference = end - start
  const minutes = Math.floor((timeDifference / (1000 * 60)) % 60)
  const hours = Math.floor((timeDifference / (1000 * 60 * 60)) % 24)

  const duration = {
    hours: hours,
    minutes: minutes,
  }

  return duration
}

async function run() {
  try {
    const calendarURL = core.getInput('calendar_url')
    const projectId = core.getInput('google_cloud_project_id')
    const key = core.getInput('google_cloud_api_key')
    const targetLanguage = core.getInput('target_language')

    const translate = new Translate({ projectId, key })

    const events = []
    const webEvents = await ical.async.fromURL(calendarURL)

    for (const event of Object.values(webEvents)) {
      if (!event.start) {
        continue
      }

      const { summary, description, ...other } = event

      const [translatedSummary] = await translate.translate(summary, {
        from: 'hu',
        to: targetLanguage,
      })

      const start = [
        other.start.getFullYear(),
        other.start.getMonth() + 1, // Months are zero-based, so add 1
        other.start.getDate(),
        other.start.getHours(),
        other.start.getMinutes(),
      ]

      events.push({
        title: translatedSummary,
        description,
        start,
        duration: calculateDuration(other.start, other.end),
        location: other.location,
        busyStatus: 'BUSY',
        transp: other.transparency,
        uid: other.uid,
        method: other.method,
        sequence: parseFloat(other.sequence ?? 0),
        alarms: [
          {
            action: 'display',
            description: 'Reminder',
            trigger: '-PT15M',
          },
        ],
      })
    }

    const { error, value } = ics.createEvents(events)

    if (error) {
      throw error
    }

    core.setOutput('result', value)
  } catch (error) {
    core.error(`Error ${error}, action may still succeed though`);
    core.setFailed(`Action failed with error ${error}`)
  }
}

run()
