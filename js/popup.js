// Dev Client ID
var CLIENT_ID = '137926979511-6sv3v9g0lsiese2i7lbaio45p4uvujdm.apps.googleusercontent.com';
//var CLIENT_ID = '959780096527-nk761kkom2cv7mvnodi9b2l018o43p9n.apps.googleusercontent.com';

// Published Client ID
//var CLIENT_ID = '959780096527-p2gansqfg71ns8unal00dodm1cbjieln.apps.googleusercontent.com';

var SCOPES = ["https://www.googleapis.com/auth/calendar"];
var eventSuccess = false;

/*
 On load, check for Google authentication
*/
window.onload = function () {
    //    checkLoad();
    checkAuth();
};

function isEventUrl() {
    console.log(window.location.pathname);
    var page = window.location.pathname.split('/')[1];
    console.log(page);
    var invalidPages = ["birthdays", "upcoming", "past", "calendar", "discovery"];
    return (!invalidPages.includes(page))
}

/*
 Initiate email.js functionality (emailjs.com)
*/
(function () {
    emailjs.init("user_Eng6TCgy2E3S4Q1Tz1Gcq");
})();


/**
 * Check if current user has authorized this application.
 * Authorization process adapted from https://developers.google.com/google-apps/calendar/quickstart/js
 */
function checkAuth() {
    gapi.auth.authorize({
        'client_id': CLIENT_ID,
        'scope': SCOPES.join(' '),
        'immediate': true
    }, handleAuthResult);
}

/**
 * Handle response from authorization server.
 *
 * @param {Object} authResult Authorization result.
 */
function handleAuthResult(authResult) {
    if (authResult && !authResult.error) {
        // Hide auth UI, then load client library.
        show('authorize-div', false)
        loadCalendarApi();
    } else {
        // Show auth UI, allowing the user to initiate authorization by
        // clicking authorize button.
        show('authorize-div', true);
    }
}

/**
 * Load Google Calendar client library.
 */
function loadCalendarApi() {
    gapi.client.load('calendar', 'v3', loadEvent);
}

/*
If automatic check fails, allow user to initiate auth flow by clicking button.
*/
document.getElementById("authorize-button").addEventListener('click', function () {
    handleAuthClick(event);
});

/**
 * Iinitiate auth flow in response to user clicking authorize button.
 *
 * @param {Event} event Button click event.
 */
function handleAuthClick(event) {
    gapi.auth.authorize({
            client_id: CLIENT_ID,
            scope: SCOPES,
            immediate: false
        },
        handleAuthResult);
    return false;
}

/**
 * Send message to extension.js to get event information from DOM
 */
var tries = 0;
var calendarList = [];

function loadEvent() {
    var request = gapi.client.calendar.calendarList.list();

    request.execute(function (resp) {
        var calendars = resp.items;
        for (var i = calendars.length; i-- > 0;) {
            if (calendars[i].accessRole == "owner" || calendars[i].accessRole == "writer") {
                if (calendars[i].primary) {
                    calendarList.unshift({
                        "summary": calendars[i].summary + " (Primary)",
                        "id": calendars[i].id
                    })
                } else {
                    calendarList.push({
                        "summary": calendars[i].summary,
                        "id": calendars[i].id
                    });
                }
            }
        }
        console.log("loadEvent", calendarList);
        getEvent();
    });
}

function getEvent() {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            type: "getEvent"
        }, function (event) {
            if (event == "loading-error") {
                report("load-error");
            } else if (event == "loading") {
                setTimeout(getEvent, 250);
            } else {
                try {
                    updateInfo(event);
                } catch (err) {
                    report("display-error");
                }
            }
        })
    });
}

/*
 Update popup window event information
*/

function updateInfo(resource) {

    // format time using Moment.js
    var time = moment(resource.start.dateTime, moment.ISO_8601).format("MMMM Do YYYY, h:mm a");

    // cap description at 95 characters, rounded to nearest word
    var description = ""
    var word = ""
    for (var i = 0; i < 95; i++) {
        if (resource.description[i] === " " || i === resource.description.length) {
            description += word;
            word = " ";
        } else {
            word += resource.description[i];
        }
    }
    // add ellipses if description truncated
    if (resource.description.length > 95) {
        description += "..."
    }

    // update fields
    document.getElementById('title').textContent = resource.summary;
    document.getElementById('start-time').textContent = time;
    document.getElementById('location').textContent = resource.location;
    document.getElementById('description').textContent = description;

    var calendarMenu = document.getElementById('calendarMenu');
    console.log("adding to options", calendarList.length);
    for (var i = 0; i < calendarList.length; i++) {
        var option = document.createElement("option");
        option.text = calendarList[i].summary;
        calendarMenu.add(option);
    }

    // update values and popup appearance
    eventSuccess = true;
    console.log("eventSuccess", true);
    show("loading-div", false);
    show("load-error", false);
    show("display-error", false);
    show("event-info", true);
    show("buttons", true);
    show("calendarMenu", true);


    // Upon button click, execute addEvent function
    document.getElementById("buttons").addEventListener('click', function () {
        gapi.client.load('calendar', 'v3', addEvent(resource));
    })
}


//add event URL to resource description
function updateDescription(resource, url) {
    if (resource.description != "") {
        resource.description += "\n\n";
    }
    var urlArray = url.match("(.*)/events/(.*)/");
    if (urlArray !== null) {
        url = urlArray[0]
    }

    resource.description += url;
    return resource;
}

/*
 * Insert event into calendar
 * adapted from https://developers.google.com/google-apps/calendar/v3/reference/events/insert
 */
function addEvent(resource) {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function (tabs) {
        var menu = document.getElementById("calendarMenu");
        var calendarId = calendarList[menu.selectedIndex].id;

        var request = gapi.client.calendar.events.insert({
            'calendarId': calendarId,
            'resource': updateDescription(resource, tabs[0].url)
        });

        // upon completion, replace add button with success
        request.execute(function (resp) {
            if ("error" in resp) {
                switch (resp.code) {
                case "403":
                    document.getElementById("add-error").textContent = "Permission denied to write to calendar."
                    break;
                case "404":
                    document.getElementById("add-error").textContent = "Adding failed."
                    break;
                }
                show("calendar-error", true);
            } else {
                document.getElementById("add-btn").src = "icons/success.png";
                document.getElementById("add-btn-hover").src = "icons/success.png"
            }
            console.log(resp)
        })
    })
}


/*
 * Shortcut function for hiding/displaying divs
 */
function show(id, value) {
    document.getElementById(id).style.display = value ? 'block' : 'none';
}

/*
 * Report bugs
 */
function report(bug_id) {
    // show error divs
    show("event-info", false);
    show("loading-div", false);
    show(bug_id, true);
    var button_id = bug_id.match("(.*)error")[1] + "report";
    // get tab information
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function (tabs) {

        // upon button click, send automated bug report with necessary info using emailjs
        document.getElementById(button_id).addEventListener('click', function () {
            var email = document.getElementById("email-input").value;
            var parameters = {
                "url": tabs[0].url,
                "time": moment().format("dddd, MMMM Do YYYY, h:mm:ss a"),
                "location": moment.tz.guess(),
                "identity": bug_id,
                "email": email
            }
            emailjs.send("gmail", "fbcalendar_bug", parameters)
                .then(function (response) {
                    console.log("SUCCESS. status=%d, text=%s", response.status, response.text);
                    $(button_id).hide();
                    $(".email-input").hide();
                    $("#bug-sent").show();
                }, function (err) {
                    console.log("FAILED. error=", err);
                });
        })
    })
}
