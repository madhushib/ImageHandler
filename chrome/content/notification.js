Components.utils.import("resource://imagehandler/common.js");
Components.utils.import("resource://imagehandler/fileUtils.js");
Components.utils.import("resource://gre/modules/PopupNotifications.jsm");

/**
 * Notification class
 *
 * @namespace Notification
 * @class ImageHandlerChrome.Notification
 * @constructor
 */
ImageHandlerChrome.Notification = function(title, savedFolderPath, browser, popupNotificationsSvc) {
    this.title = title;
    this.savedFolderPath = savedFolderPath;
    this.browser = browser;
    this.popupNotificationsSvc = popupNotificationsSvc;
    if (!this.popupNotificationsSvc) {
        this.popupNotificationsSvc = PopupNotifications;
    }

};

ImageHandlerChrome.Notification.prototype = {
    show : function() {
        var fileUtils = ImageHandler.FileUtils;
        var alertListener = {
            observe : function(subject, topic, data) {
                if (topic == "alertclickcallback") {
                    var dir = fileUtils.toDirectory(data);
                    fileUtils.revealDirectory(dir);
                }
            }
        };

        try {
            var alertsService = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
            alertsService.showAlertNotification("chrome://imagehandler/skin/img-picker_32.png", this.title,
                    this.savedFolderPath, true, this.savedFolderPath, alertListener, "ImageHandlerAlert");
            //abcefg.throwEx();
        } catch (ex) {
            ImageHandler.Logger.error("Occured Error " + ex);
            var filePath = this.savedFolderPath;

            var openAction = function() {
                var dir = fileUtils.toDirectory(filePath);
                fileUtils.revealDirectory(dir);
            };

            var notification = this.popupNotificationsSvc.show(this.browser, /* browser */
            "ImageHandlerAlert", this.title, null, /* anchor ID */
            {
                label : "Open",
                accessKey : "O",
                callback : openAction
            }, null /* secondary action */
            );

            setTimeout(function() {
                notification.remove();
            }, 1500); // Time in seconds to disappear the door-hanger popup.
        }
    }
};
