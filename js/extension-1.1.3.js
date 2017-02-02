// initialize variables
var event = "";
var tries = 0;
var loadError = false;

window.onload = extension;

/*
 If error arises while running extension, wait and try again before changing loadError to true
*/
function error() {
	if (tries == 8) {
		loadError = true;
	} else {
		tries += 1;
		console.log("trying extension again :", tries);
		setTimeout(extension, 250);
	}
}

/*
 Main extension function - retrieves info from DOM and adds to event object
*/
function extension() {
	$(document).ready(function () {
		try {
			// GET EVENT TITLE
			var title = "";
			var temp = $("[data-testid='event-permalink-event-name']")[0];
			if (typeof temp !== 'undefined') {
				title = temp.innerText
			} else {
				return error();
			}

			// set of functions to get text from within HTML tag, separated by spaces or line breaks  
			// adapted from http://stackoverflow.com/questions/2836317/using-jquery-to-gather-all-text-nodes-from-a-wrapped-set-separated-by-spaces
			function collectTextNodes(element, texts) {
				for (var child = element.firstChild; child !== null; child = child.nextSibling) {
					if (child.nodeType === 3)
						texts.push(child);
					else if (child.nodeType === 1)
						collectTextNodes(child, texts);
				}
			}

			function getTextWithSpaces(element) {
				var texts = [];
				collectTextNodes(element, texts);
				for (var i = texts.length; i-- > 0;)
					texts[i] = texts[i].data;
				return texts.join(' ');
			}

			function getTextWithBreaks(element) {
				var texts = [];
				collectTextNodes(element, texts);
				for (var i = texts.length; i-- > 0;)
					texts[i] = texts[i].data;
				return texts.join('\n');
			}

			// get text from Facebook's event summary
			var element = document.getElementById("event_summary")
			var textWithSpaces = getTextWithSpaces(element);
			var textWithBreaks = getTextWithBreaks(element);

			// GET ADDRESS
			var address = "";
			
			// temp1: if address is linked to map; temp2: address is plain text
			var temp1 = textWithSpaces.match("Hide Map (.*) Report")
			var temp2 = textWithBreaks.match("pin\n(.*)")
			if (temp1 !== null) {
				address = temp1[1];
			} else if (temp2 !== null) {
				address = temp2[1]
			}
			
			if (address == "Show Map") {
				return error();
			}

			// GET START AND END TIMES
			// uses MIT's indispensable Moment.js (momentjs.com) 

			// get Facebook-defined startDate for event 
			var startDT = $("[itemprop='startDate']").attr('content');
			var endDT = ""

			// use RegEx to define temporary start and end
			var start = textWithBreaks.match("at \n(.*)\n");
			var end = textWithBreaks.match("- \n(.*)\n");
			if (end === null) {
				// replace normal dash w/ em-dash
				end = textWithBreaks.match("– \n(.*)\n");
			}

			// if start exists, first line is of form "Date at time (- time)"
			if (start !== null) {
				start = moment(start[1], 'h A')

				// if end exists, event has end time
				if (end !== null) {
					end = moment(end[1], 'h A')

					// calculate difference bet. start and end
					var diff = moment.duration(end.diff(start));

					// if event goes overnight, diff may be negative (ex. 10 PM to 2 AM) - subtract from 24 hrs
					if (diff._milliseconds < 0) {
						diff._milliseconds = 86400000 + diff._milliseconds;
					}

					// add difference to startDT for endDT
					var sum = moment(startDT, moment.ISO_8601).add(diff)
					endDT = sum.format()
				}

				// else, automatically make event one hour long
				else {
					var sum = moment(startDT, moment.ISO_8601).add(1, 'hours')
					endDT = sum.format()
				}
			}
			// else if start doesn't exist (first line of form "Date - Date")
			else {
				// time information then located in second line; similar process
				var line2 = textWithBreaks.match(end[1] + "\n(.*)\n")
				start = line2[1].match("(.*) to")[1]
				end = line2[1].match("to (.*)M")[1]
				end = moment(end, 'MMM D at h:MM A')
				start = moment(start, 'MMM D at h:MM A')
				var diff = moment.duration(end.diff(start));
				var sum = moment(startDT, moment.ISO_8601).add(diff)
				endDT = sum.format()
			}

			// GET DESCRIPTION
			// use id if available; else by classes
			var description = ""
			if ($("#event_description").length > 0) {
				description = $("#event_description").text();
			} else {
				description = $("._4n-j._3cht.fsl").text();
			}

			// add info to event object	
			event = {
				'summary': title,
				'location': address,
				'description': description,
				'start': {
					'dateTime': startDT,
				},
				'end': {
					'dateTime': endDT,
				},
			};
		}

		// run error function if any errors thrown
		catch (err) {
			console.log(err.message);
			error();
		}
	})
};

// listen for messages
chrome.runtime.onMessage.addListener(
	function (message, sender, sendResponse) {
		switch (message.type) {
			// send event when popup asks
			case "getEvent":
				sendResponse(event);
				break;

				// if URL changed, re-run extension
			case "tabUpdated":
				sendResponse("received");
				extension();
				break;

				// tell popup if loading error occurred 
			case "checkError":
				sendResponse(loadError);
				break;

				// else, log error
			default:
				console.error("Unrecognised message: ", message);
		}
	}
);
