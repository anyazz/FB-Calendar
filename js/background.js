var CLIENT_ID = '959780096527-unuimtrulehucog1s44m8vq8v0ob1lin.apps.googleusercontent.com';
var SCOPES = ["https://www.googleapis.com/auth/calendar"];

// show extension and load scripts on Facebook event pages
// adapted from http://stackoverflow.com/questions/20855956/how-to-show-chrome-extension-on-certain-domains
function onWebNav(details) {
	if (details.frameId === 0) {
		// Top-level frame
		chrome.pageAction.show(details.tabId);
		console.log("fb");
		chrome.tabs.executeScript({
			file: "js/jquery-3.1.1.js"
		}, function () {
			console.log("jquery Loaded");
		});
		chrome.tabs.executeScript({
			file: "extension.js"
		}, function () {
			console.log("content loaded");
		});
	}
}
var filter = {
	url: [{
		urlContains: 'facebook.com/events'
    }]
};
chrome.webNavigation.onCommitted.addListener(onWebNav, filter);
chrome.webNavigation.onHistoryStateUpdated.addListener(onWebNav, filter);

// get Google authentication token
chrome.identity.getAuthToken({
	'interactive': true
}, function (token) {
	return true;
});

// when tab url changed, notify extension.js
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
	if (changeInfo.status == 'complete') {
		console.log("complete")
		chrome.tabs.query({
			active: true,
			currentWindow: true
		}, function (tabs) {
			chrome.tabs.sendMessage(tabs[0].id, {
				type: "tabUpdated"
			}, function (response) {
				console.log("message received:", response)
			});
		});
	}
});
