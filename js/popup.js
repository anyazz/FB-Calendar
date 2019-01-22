// Dev Client ID
//var CLIENT_ID = '959780096527-sk8sgb89g46rff403qj80jarlofv46nr.apps.googleusercontent.com';

// Published Client ID
var CLIENT_ID = '959780096527-3840ecdn47brr0lqefodnf9rt96uvqnd.apps.googleusercontent.com';

var SCOPES = ["https://www.googleapis.com/auth/calendar"];
var eventSuccess = false;
var calendarList = [];

/*
 * On load, check for Google authentication
 */
 window.onload = function() {
    loadEvent();
};

/*
 * Initiate email.js functionality
 */
(function () {
    emailjs.init("user_Eng6TCgy2E3S4Q1Tz1Gcq");
})();

/*
 * Load event info into popup window
 */

function loadEvent() {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function (tabs) {
        if (isEventUrl(tabs[0].url)) {
            // load user's calendar list from Google API
            chrome.identity.getAuthToken({ 'interactive': false }, function(token) {
                const headers = new Headers({
                  'Authorization' : 'Bearer ' + token,
                  'Content-Type': 'application/json'
                })
                const queryParams = { headers };
                fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', queryParams)
                .then((response) => response.json()) // Transform the data into json
                .then(function(data) {
                    var calendars = data.items;
                    if (calendars) {
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
                        console.log("CAL #", calendars.length)
                    getEvent();
                    }
                    else {
                        $("#authorize-div").show();
                        $('#loading-div').hide();
                    }
                });
            })
        } else {
            $("#event-error").show();
            $("#loading-div").hide();
        }
    })
}

// Check if url links to an FB event page
function isEventUrl(url) {
    if (!url.includes("events")) {
        return false
    }
    var array = url.match('/events/(.*)/');
    var eventID;
    if (array != null) {
        eventID = array[1]
    } else {
        var urlArray = url.split('/')
        eventID = urlArray[urlArray.length - 1];
    }
    var isEvent = /^\d+$/.test(eventID);
    console.log(isEvent);
    return (isEvent);
}

/*
 * Send message to extension.js to get event information from DOM
 */
function getEvent() {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            type: "getEvent"
        }, function (event) {
            if (event == "loading-error") {
                report("load");
            } else if (event == "loading") {
                setTimeout(getEvent, 250);
            } else {
                try {
                    updateInfo(event);
                } catch (err) {
                    report("display");
                }
            }
        })
    });
}

/*
 * Populate popup window fields
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
    for (var i = 0; i < calendarList.length; i++) {
        var option = document.createElement("option");
        option.text = calendarList[i].summary;
        calendarMenu.add(option);
    }

    // update values and popup appearance
    eventSuccess = true;
    $("#loading-div").hide();
    $("#event-info").show();
    $("#buttons").show();
    $("#calendarMenu").show();


    // upon button click, execute addEvent function
    $("#buttons").click(function () {
        addEvent(resource);
    })
}
// https://zapier.com/engineering/how-to-use-the-google-calendar-api/
var makeQuerystring = params =>
  Object.keys(params)
    .map(key => {
      return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]);
    })
    .join("&");

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
        chrome.identity.getAuthToken({ 'interactive': false }, function(token) {
            const headers = new Headers({
              'Authorization' : 'Bearer ' + token,
              'Content-Type': 'application/json; charset=utf-8',
            })
            const queryParams = { 
                method: 'POST',   
                headers,  
                body: JSON.stringify(updateDescription(resource, tabs[0].url)), 
                key: 'AIzaSyAkpxDTtGgwKTJXGG-_szBEBCj0jIy5C0M'
            };
            fetch('https://www.googleapis.com/calendar/v3/calendars/' + calendarId + '/events', queryParams)
            .then((response) => response.json()) // Transform the data into json
            .then(function(data) {
                console.log(data)
                if ("error" in data) {
                    console.log(data.error.code)
                    switch (data.error.code) {
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
            })
        })
    })
}

/*
 * Append Facebook URL to event description
 */
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
 * Report bugs
 */
function report(bug_id) {
    // show error div
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
                $(email_id).val(email);
                checkbox.checked = true;

                // upon button click, send automated bug report with necessary info using email-js
                $(button_id).click(function () {
                        $(form_id).hide();
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
                                $("#sending-div").hide();
                                $("#bug-sent").show();
                            }, function (err) {
                                // console.log("FAILED. error=", err);
                            });
                    })
                    // upon checkbox or text click, populate/clear input field and check/uncheck checkbox
                $(check_id).click(function (e) {

                    // check if inner object clicked was checkbox - if so, undo action
                    e = e || event
                    var target = e.target || e.srcElement
                    innerId = target.id;
                    if (innerId === checkbox_id.substring(1)) {
                        checkbox.checked = (!checkbox.checked)
                    }

                    // reverse state of input and checkbox
                    if (checkbox.checked) {
                        checkbox.checked = false;
                        $(email_id).val("");
                    } else {
                        checkbox.checked = true;
                        $(email_id).val(email);
                    }
                })
            }
        );
    })
}
