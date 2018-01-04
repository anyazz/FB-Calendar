// Dev Client ID
var CLIENT_ID = '959780096527-sk8sgb89g46rff403qj80jarlofv46nr.apps.googleusercontent.com';

// Published Client ID
//var CLIENT_ID = '959780096527-p2gansqfg71ns8unal00dodm1cbjieln.apps.googleusercontent.com    ';

var SCOPES = ["https://www.googleapis.com/auth/calendar"];
var eventSuccess = false;

/*
 On load, check for Google authentication
*/

window.onload = function () {
    checkAuth();
};

// Check if url links to an event page
function isEventUrl(url) {
    console.log(url);
    return true
        //    if (!url.includes("events")) {
        //        return false
        //    }
        //    var array = url.match('/events/(.*)/');
        //    var eventID;
        //    if (array != null) {
        //        eventID = array[1]
        //    }
        //    else {
        //        var urlArray = url.split('/')
        //        eventID = urlArray[urlArray.length-1];
        //    }
        //    return (/^\d+$/.test(eventID))
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
        $('#authorize-div').hide()
        loadCalendarApi();
    } else {
        // Show auth UI, allowing the user to initiate authorization by
        // clicking authorize button.
        $('#authorize-div').show();
        $('#loading-div').hide();
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
$("#auth-buttons").click(function () {
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
 * Load event info into popup window
 */
var calendarList = [];

function loadEvent() {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function (tabs) {
        if (isEventUrl(tabs[0].url)) {
            console.log("valid url")
                // load user's calendar list from Google API
            var request = gapi.client.calendar.calendarList.list();

            request.execute(function (resp) {
                var calendars = resp.items;
                for (var i = calendars.length; i-- > 0;) {
                    var accessRole = calendars[i].accessRole;
                    if (accessRole == "owner" || accessRole == "writer") {
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
        } else {
            console.log("invalid url")
            $("#event-error").show();
            $("#loading-div").hide();
        }
    })
}

// Send message to extension.js to get event information from DOM
function getEvent() {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            type: "getEvent"
        }, function (event) {
            console.log(event);
            if (event == "loading-error") {
                report("load");
            } else if (event == "loading") {
                setTimeout(getEvent, 250);
            } else {
                try {
                    updateInfo(event);
                } catch (err) {
                    console.log(err)
                    report("display");
                }
            }
        })
    });
}

/*
 Populate popup window fields
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
    $('#title').text(resource.summary);
    $('#start-time').text(time);
    $('#location').text(resource.location);
    $('#description').text(description);

    var calendarMenu = $('#calendarMenu')[0];
    console.log("adding to options", calendarList.length);
    for (var i = 0; i < calendarList.length; i++) {
        var option = document.createElement("option");
        option.text = calendarList[i].summary;
        calendarMenu.add(option);
    }

    // update values and popup appearance
    eventSuccess = true;
    console.log("eventSuccess", true);
    $("#loading-div").hide();
    $("#event-info").show();
    $("#buttons").show();
    $("#calendarMenu").show();


    // Upon button click, execute addEvent function
    $("#buttons").click(function () {
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
        var menu = $("#calendarMenu")[0];
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
                    $("#add-error").text("Permission denied to write to calendar.");
                    break;
                case "404":
                    $("#add-error").text("Adding failed.");
                    break;
                }
                $("#calendar-error").show();
            } else {
                $("#add-btn")[0].src = "icons/success.png";
                $("#add-btn-hover")[0].src = "icons/success.png"
            }
            console.log(resp)
        })
    })
}

/*
 * Report bugs
 */
function report(bug_id) {
    // show error divs
    $("#event-info").hide();
    $("#loading-div").hide();
    $("#error-div").show();

    $("#error-text").text("Error " + bug_id + "ing event details.");
    if (bug_id == "load") {
        $("#error-description")[0].innerText += "If this is an event page, please refresh the page and try again. "
    }
    if (bug_id == "display") {
        $("#error-description")[0].innerText += "Please close the popup window and try again. "
    }
    $("#error-description")[0].innerText += "If this continues to appear, click below to send an automatic bug report! Optionally, include your email if you'd like follow-up about the error."
    var button_id = "#error-report";
    var email_id = "#email-input";
    var checkbox_id = "#email-checkbox";
    var check_id = "#email-check";
    var form_id = "#error-form"

    var checkbox = $(checkbox_id)[0];

    // get tab information
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function (tabs) {
        chrome.runtime.sendMessage({
                type: "getEmail"
            },
            function (response) {
                var email = response.email;
                console.log(response);
                console.log(email);
                $(email_id).val(email);
                checkbox.checked = true;

                // upon button click, send automated bug report with necessary info using email-js
                $(button_id).click(function () {
                    console.log("clicked");
                    $(form_id).false();
                    $("#sending-div").show();
                    var parameters = {
                        "url": tabs[0].url,
                        "time": moment().format("dddd, MMMM Do YYYY, h:mm:ss a"),
                        "location": moment.tz.guess(),
                        "identity": bug_id + "-error",
                        "email": email
                    }
                    emailjs.send("gmail", "fbcalendar_bug", parameters)
                        .then(function (response) {
                            console.log("SUCCESS. status=%d, text=%s", response.status, response.text);
                            $("#sending-div").hide();
                            $("#bug-sent").show();
                        }, function (err) {
                            console.log("FAILED. error=", err);
                        });
                })
                // upon checkbox or text click, populate/clear input field and check/uncheck checkbox
                $(check_id).click(function (e) {

//                     Check if inner object clicked was checkbox - if so, undo action
                    e = e || event
                    var target = e.target || e.srcElement
                    innerId = target.id;
                    if (innerId === checkbox_id.substring(1)) {
                        checkbox.checked = (!checkbox.checked)
                    }

                    // Reverse state of input and checkbox
                    console.log("click")
                    if (checkbox.checked) {
                        console.log("uncheck")
                        checkbox.checked = false;
                        $(email_id).val("");
                    } else {
                        console.log("check")
                        checkbox.checked = true;
                        $(email_id).val(email);
                    }
                })
            });
    })
}
