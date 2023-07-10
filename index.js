const fs = require('fs').promises;
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');
const _ = require("lodash");

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const ACCEPTED_STATUS = "accepted";
const EVENT_ORDER_BY_CLAUSE = 'startTime';
const MAX_BILLABLE_HOURS = 40;
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
    try {
        const content = await fs.readFile(TOKEN_PATH);
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
    } catch (err) {
        return null;
    }
}

/**
 * Serializes credentials to a file compatible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
    const content = await fs.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content);
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
    let client = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: SCOPES,
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}

function eventDuration(currentEvent) {
    const start = new Date(currentEvent.start.dateTime || currentEvent.start.date);
    const end = new Date(currentEvent.end.dateTime || currentEvent.end.date);
    const duration = (end - start) / (1000 * 60 * 60);
    return duration;
}

/**
 * Lists the next events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function aggregateEvents(auth) {
    const calendar = google.calendar({version: 'v3', auth});
    const start = new Date(2023, 6, 10);
    const end = new Date(2023, 6, 15);
    const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        maxResults: 100,
        singleEvents: true,
        orderBy: EVENT_ORDER_BY_CLAUSE,
    });
    const events = res.data.items;
    if (!events || events.length === 0) {
        console.log('No upcoming events found.');
        return;
    }

    console.log(`${events.length} accepted events from ${start} to ${end}:`);
    acceptedEvents = events.filter(event => {
        me = event.attendees.find(attendee => attendee.self)
        return ACCEPTED_STATUS === me.responseStatus
    })

    const totalDuration = acceptedEvents.reduce((totalHours, currentEvent) => totalHours + eventDuration(currentEvent), 0)
    const acceptedEventsGroupedByDay = _.groupBy(acceptedEvents, event => new Date(event.start.dateTime).getDay())

    _.forEach(acceptedEventsGroupedByDay, (events, day) => {
        console.log(`DAY ${day}`)
        console.log("-----------")
        eventsGroupedByTags = _.groupBy(events, event => {
            me = event.attendees.find(attendee => attendee.self)
            return me.comment
        })

        _.forEach(eventsGroupedByTags, (group, tag) => {
            groupDuration = group.reduce(function(total, currentEvent) {
                const duration = eventDuration(currentEvent);
                return total + duration
            }, 0)

            console.log(`${tag} => ${JSON.stringify(groupDuration)}`)
        })
        console.log()
    })

    console.log(`Total hours accounted for: ${totalDuration}`)
    console.log(`Total unaccounted hours: ${MAX_BILLABLE_HOURS - totalDuration}`)
}


authorize().then(aggregateEvents).catch(console.error);
